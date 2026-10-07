const { app, BaseWindow, WebContentsView, Menu, ipcMain, net, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { Readable } = require('stream')
const { pipeline } = require('stream/promises')
const { pathToFileURL } = require('url')

// No polling and no retry loops. On every launch the player fetches what is assigned to the
// screen ONCE, saves it to local disk, and plays from the local copy. If the server cannot
// be reached it plays the last saved copy. Changes in the CMS show up on the next launch.
const REQUEST_TIMEOUT_MS = 20_000

let win = null
let contentView = null
let overlayView = null
let current = null // { serverUrl, screenId }

// ── Config ────────────────────────────────────────────────────────────────────
// build-config.json is written by CI (CMS_URL repo variable) and gives the default
// server. The last used server/screen are remembered per machine in userData.

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

const userConfigPath = () => path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  const defaults = readJson(path.join(__dirname, 'build-config.json'))
  const saved = readJson(userConfigPath())
  return {
    serverUrl: saved.serverUrl || process.env.CMS_URL || defaults.serverUrl || '',
    screenId: saved.screenId || '',
  }
}

function saveConfig(config) {
  try {
    fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true })
    fs.writeFileSync(userConfigPath(), JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save config', error)
  }
}

function normalizeServerUrl(value) {
  let url = String(value || '').trim().replace(/\/+$/, '')
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}

// ── Content: fetch once, save locally, play from disk ─────────────────────────

const cacheDir = () => path.join(app.getPath('userData'), 'content')
const manifestPath = () => path.join(cacheDir(), 'manifest.json')

async function fetchJson(url) {
  const response = await net.fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

function extensionFor(asset) {
  const fromName = path.extname(asset.name || '')
  if (fromName) return fromName.toLowerCase()
  const sub = String(asset.mimeType || '').split('/')[1] || 'bin'
  return `.${sub.split(/[;+]/)[0]}`
}

async function downloadTo(url, file) {
  const response = await net.fetch(url, { signal: AbortSignal.timeout(10 * 60_000) })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
  const partial = `${file}.part`
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial))
  fs.renameSync(partial, file)
}

// Fetch the screen's assignment and save the file locally. Returns the manifest entry
// ({ name, mimeType, kind, file | url }) or null when nothing is assigned.
async function syncContent({ serverUrl, screenId }) {
  const assets = await fetchJson(`${serverUrl}/api/screens/${encodeURIComponent(screenId)}/assets`)
  const doc = assets[0]?.document
  fs.mkdirSync(cacheDir(), { recursive: true })

  if (!doc) {
    const manifest = { screenId, asset: null }
    fs.writeFileSync(manifestPath(), JSON.stringify(manifest))
    return manifest.asset
  }

  const base = { name: doc.name, mimeType: doc.mimeType }
  let asset
  if (doc.websiteUrl) {
    // A live website cannot be stored locally; it is opened from its address.
    asset = { ...base, url: doc.websiteUrl }
  } else if (doc.cloudinaryUrl) {
    const file = path.join(cacheDir(), `${doc.id}-${new Date(doc.updatedAt).getTime()}${extensionFor(doc)}`)
    if (!fs.existsSync(file)) await downloadTo(doc.cloudinaryUrl, file)
    asset = { ...base, file }
  } else {
    asset = null
  }

  fs.writeFileSync(manifestPath(), JSON.stringify({ screenId, asset }))
  // Remove files that are no longer assigned to this screen.
  for (const name of fs.readdirSync(cacheDir())) {
    if (name !== 'manifest.json' && path.join(cacheDir(), name) !== asset?.file) {
      fs.rmSync(path.join(cacheDir(), name), { force: true })
    }
  }
  return asset
}

function readSavedContent(screenId) {
  const manifest = readJson(manifestPath())
  if (manifest.screenId !== screenId || !('asset' in manifest)) return undefined
  if (manifest.asset?.file && !fs.existsSync(manifest.asset.file)) return undefined
  return manifest.asset
}

function show(params) {
  const query = new URLSearchParams(params).toString()
  contentView.webContents.loadFile(path.join(__dirname, 'player.html'), { search: query })
}

function showAsset(asset) {
  if (!asset) return show({ kind: 'saver' })
  const mime = asset.mimeType || ''
  const kind = asset.url
    ? 'website'
    : mime.startsWith('image/') ? 'image'
    : mime.startsWith('video/') ? 'video'
    : mime.startsWith('audio/') ? 'audio'
    : mime === 'application/pdf' ? 'pdf'
    : 'message'
  if (kind === 'message') return show({ kind, text: asset.name || 'Unsupported file type.' })
  show({ kind, name: asset.name || '', src: asset.url || pathToFileURL(asset.file).href })
}

// Sync once, then play from local. Used on every launch and after the Screen ID is entered.
async function loadScreen() {
  const { serverUrl, screenId } = current
  let asset
  try {
    asset = await syncContent(current)
  } catch (error) {
    console.error('Sync failed, using saved copy', error)
    asset = readSavedContent(screenId)
    if (asset === undefined) {
      return show({ kind: 'message', text: 'Could not reach the server and nothing is saved yet. Press Ctrl+R to try again.' })
    }
  }
  showAsset(asset)
}

async function openScreen({ serverUrl, screenId }) {
  serverUrl = normalizeServerUrl(serverUrl)
  screenId = String(screenId || '').trim()

  if (!serverUrl) return { ok: false, error: 'Enter the server address.', needServer: true }
  if (!screenId) return { ok: false, error: 'Enter a Screen ID.' }

  try {
    await fetchJson(`${serverUrl}/api/screens/${encodeURIComponent(screenId)}`)
  } catch (error) {
    if (error.status === 404) return { ok: false, error: `No screen found with ID "${screenId}".` }
    return {
      ok: false,
      error: `Could not reach the server (${error.message}). Check the server address.`,
      needServer: true,
    }
  }

  current = { serverUrl, screenId }
  saveConfig({ serverUrl, screenId })
  hideOverlay()
  loadScreen()
  return { ok: true }
}

// On launch, reopen the saved server + screen without asking. The Screen ID modal only
// appears when nothing is saved yet (or on Ctrl+R / F5).
function openSavedScreen() {
  const { serverUrl, screenId } = loadConfig()
  const server = normalizeServerUrl(serverUrl)
  const id = String(screenId || '').trim()
  if (!server || !id) return false

  current = { serverUrl: server, screenId: id }
  hideOverlay()
  loadScreen()
  return true
}

// ── Overlay (Screen ID modal) ─────────────────────────────────────────────────

function showOverlay() {
  if (!overlayView) return
  overlayView.setVisible(true)
  overlayView.webContents.focus()
  overlayView.webContents.send('overlay:show', { ...loadConfig(), canCancel: Boolean(current) })
}

function hideOverlay() {
  overlayView.setVisible(false)
  contentView.webContents.focus()
}

// Ctrl+R / Ctrl+Shift+R / F5 never reload: they bring back the Screen ID modal.
// Ctrl+Shift+Q quits the kiosk.
function attachShortcuts(webContents) {
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    const ctrl = input.control || input.meta

    if (ctrl && input.shift && key === 'q') {
      event.preventDefault()
      app.quit()
    } else if ((ctrl && key === 'r') || key === 'f5') {
      event.preventDefault()
      showOverlay()
    }
  })
}

// ── Install location + shortcuts ──────────────────────────────────────────────
// A portable exe runs from a temporary folder that is deleted on exit, so anything pinned
// to the taskbar while it is running would break. On launch the exe therefore keeps a
// permanent copy of itself in %LOCALAPPDATA%\XOS and points the Desktop and Start menu
// shortcuts at that copy. Pin the Desktop/Start menu "XOS" shortcut to the taskbar (or
// pin the running app: Windows resolves it to the shortcut/permanent copy).

function ensureInstalled() {
  if (process.platform !== 'win32' || !app.isPackaged) return
  try {
    const source = process.env.PORTABLE_EXECUTABLE_FILE
    if (!source || !fs.existsSync(source)) return

    const installDir = path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'XOS')
    const target = path.join(installDir, 'XOS.exe')
    const sourceStat = fs.statSync(source)
    const targetStat = fs.existsSync(target) ? fs.statSync(target) : null
    if (path.resolve(source).toLowerCase() !== path.resolve(target).toLowerCase() &&
        (!targetStat || targetStat.size !== sourceStat.size || targetStat.mtimeMs < sourceStat.mtimeMs)) {
      fs.mkdirSync(installDir, { recursive: true })
      fs.copyFileSync(source, `${target}.tmp`)
      fs.renameSync(`${target}.tmp`, target)
    }

    const options = { target, cwd: installDir, icon: target, iconIndex: 0, description: 'XOS', appUserModelId: 'com.trfastenings.screenplayer' }
    const links = [
      path.join(app.getPath('desktop'), 'XOS.lnk'),
      path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'XOS.lnk'),
    ]
    const marker = path.join(app.getPath('userData'), 'shortcuts-created')
    const firstRun = !fs.existsSync(marker)
    for (const link of links) {
      if (fs.existsSync(link)) {
        // Repoint existing shortcuts (e.g. ones made by an older build).
        if (shell.readShortcutLink(link).target !== target) shell.writeShortcutLink(link, 'update', options)
      } else if (firstRun) {
        shell.writeShortcutLink(link, 'create', options)
      }
    }
    if (firstRun) {
      fs.mkdirSync(path.dirname(marker), { recursive: true })
      fs.writeFileSync(marker, '1')
    }
  } catch (error) {
    console.error('Failed to install shortcuts', error)
  }
}

// ── Window ────────────────────────────────────────────────────────────────────

function layoutViews() {
  const { width, height } = win.getContentBounds()
  const bounds = { x: 0, y: 0, width, height }
  contentView.setBounds(bounds)
  overlayView.setBounds(bounds)
}

function createWindow() {
  win = new BaseWindow({
    title: 'XOS',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#000000',
    fullscreen: true,
    kiosk: true,
    frame: false,
    autoHideMenuBar: true,
  })

  contentView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  contentView.setBackgroundColor('#000000')

  overlayView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  overlayView.setBackgroundColor('#00000000')

  // Added last = drawn on top.
  win.contentView.addChildView(contentView)
  win.contentView.addChildView(overlayView)
  layoutViews()
  win.on('resize', layoutViews)

  for (const wc of [contentView.webContents, overlayView.webContents]) {
    attachShortcuts(wc)
    // Keep everything inside the kiosk: no popups or new windows.
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  }

  contentView.webContents.loadURL('about:blank')
  overlayView.webContents.loadFile(path.join(__dirname, 'overlay.html'))
  overlayView.setVisible(false)
  overlayView.webContents.once('did-finish-load', () => {
    if (!openSavedScreen()) showOverlay()
  })

  win.on('closed', () => {
    win = contentView = overlayView = null
  })
}

ipcMain.handle('overlay:submit', (_event, payload) => openScreen(payload || {}))
ipcMain.on('overlay:cancel', () => {
  if (current) hideOverlay()
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      win.focus()
      showOverlay()
    }
  })

  app.whenReady().then(() => {
    // No application menu, so its default Reload (Ctrl+R) accelerator does not exist.
    // Same id as the shortcuts, so a pinned shortcut and the running window share one taskbar icon.
    app.setAppUserModelId('com.trfastenings.screenplayer')
    Menu.setApplicationMenu(null)
    createWindow()
    ensureInstalled()
  })

  app.on('window-all-closed', () => app.quit())
}
