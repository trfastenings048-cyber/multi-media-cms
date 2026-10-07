const { app, BaseWindow, WebContentsView, Menu, ipcMain, net } = require('electron')
const fs = require('fs')
const path = require('path')

// How often to check the CMS for a changed asset assignment on the current screen.
const POLL_INTERVAL_MS = 30_000
// How long to wait before retrying when the screen page fails to load.
const RETRY_DELAY_MS = 10_000

let win = null
let contentView = null
let overlayView = null
let current = null // { serverUrl, screenId, signature }
let pollTimer = null
let retryTimer = null

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

// ── Screen loading ────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const response = await net.fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

// A fingerprint of what is assigned to the screen, so polling can tell when it changes.
async function fetchSignature(serverUrl, screenId) {
  const assets = await fetchJson(`${serverUrl}/api/screens/${encodeURIComponent(screenId)}/assets`)
  return JSON.stringify(assets.map((a) => [a.id, a.documentId, a.updatedAt, a.document?.updatedAt]))
}

function loadScreenPage() {
  clearTimeout(retryTimer)
  const { serverUrl, screenId } = current
  contentView.webContents.loadURL(`${serverUrl}/view/screen/${encodeURIComponent(screenId)}?kiosk=1`)
}

function startPolling() {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!current) return
    try {
      const signature = await fetchSignature(current.serverUrl, current.screenId)
      if (signature !== current.signature) {
        current.signature = signature
        loadScreenPage()
      }
    } catch {
      // Server temporarily unreachable: keep showing what is already on screen.
    }
  }, POLL_INTERVAL_MS)
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

  let signature = null
  try {
    signature = await fetchSignature(serverUrl, screenId)
  } catch {
    // Not fatal: the next poll will pick it up.
  }

  current = { serverUrl, screenId, signature }
  saveConfig({ serverUrl, screenId })
  loadScreenPage()
  startPolling()
  hideOverlay()
  return { ok: true }
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

  contentView.webContents.on('did-fail-load', (_event, errorCode, _description, _url, isMainFrame) => {
    // -3 is ERR_ABORTED (e.g. a new load replaced this one), not a real failure.
    if (!isMainFrame || errorCode === -3 || !current) return
    clearTimeout(retryTimer)
    retryTimer = setTimeout(loadScreenPage, RETRY_DELAY_MS)
  })
  contentView.webContents.on('render-process-gone', () => {
    if (current) loadScreenPage()
  })

  contentView.webContents.loadURL('about:blank')
  overlayView.webContents.loadFile(path.join(__dirname, 'overlay.html'))
  overlayView.webContents.once('did-finish-load', showOverlay)

  win.on('closed', () => {
    clearInterval(pollTimer)
    clearTimeout(retryTimer)
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
    Menu.setApplicationMenu(null)
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
