const { app, BaseWindow, WebContentsView, ipcMain } = require('electron')
const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const { createNavigation } = require(process.argv.includes('--packaged')
  ? path.join(__dirname, 'dist', 'win-unpacked', 'resources', 'app.asar', 'navigation.js')
  : './navigation')

app.disableHardwareAcceleration()
let server, win
const timeout = setTimeout(() => { console.error('Navigation check timed out'); app.exit(1) }, 30000)
const waitFor = async (check) => {
  for (let i = 0; i < 200; i++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('Navigation state did not settle')
}

app.whenReady().then(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html')
    res.end(`<title>${req.url}</title><a id="normal" href="/normal">Normal</a><a id="blank" href="/blank" target="_blank">New tab</a><button id="popup" onclick="window.open('/popup')">Popup</button>`)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  win = new BaseWindow({ show: false, width: 1000, height: 700 })
  const contentView = new WebContentsView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  win.contentView.addChildView(contentView)
  const navigation = createNavigation({ win, contentView, WebContentsView, ipcMain })
  const wc = contentView.webContents
  navigation.toolbar.webContents.on('console-message', (_event, details) => console.log('Toolbar:', details.message))
  navigation.toolbar.webContents.on('preload-error', (_event, _file, error) => console.error('Preload:', error))
  let extraWindows = 0
  app.on('browser-window-created', () => extraWindows++)
  await waitFor(() => !navigation.toolbar.webContents.isLoading())
  await navigation.loadWebsite(`${base}/home`)
  const buttonEnabled = () => navigation.toolbar.webContents.executeJavaScript('!document.getElementById("back").disabled')
  assert.equal(await buttonEnabled(), false)
  for (const id of ['normal', 'blank', 'popup']) {
    await wc.executeJavaScript(`document.getElementById('${id}').click()`, true)
    await waitFor(() => wc.getURL() === `${base}/${id}` && !wc.isLoading())
    await waitFor(buttonEnabled)
    await navigation.toolbar.webContents.executeJavaScript('document.getElementById("back").click()')
    await waitFor(() => wc.getURL() === `${base}/home` && !wc.isLoading())
    await waitFor(async () => !(await buttonEnabled()))
  }
  assert.equal(await wc.executeJavaScript('typeof window.player'), 'undefined')
  await wc.executeJavaScript(`window.open('http://localhost:${server.address().port}/cross-origin')`, true)
  await waitFor(() => wc.getURL().endsWith('/cross-origin') && !wc.isLoading())
  await waitFor(buttonEnabled)
  await navigation.toolbar.webContents.executeJavaScript('document.getElementById("back").click()', true)
  await waitFor(() => wc.getURL() === `${base}/home` && !wc.isLoading())
  win.setSize(1200, 800)
  await waitFor(() => {
    const { width, height } = win.getContentBounds()
    const bounds = navigation.toolbar.getBounds()
    return bounds.x + bounds.width === width - 24 && bounds.y + bounds.height === height - 24
  })
  await wc.executeJavaScript('document.getElementById("normal").click()', true)
  await waitFor(() => wc.getURL() === `${base}/normal` && !wc.isLoading())
  await navigation.loadWebsite(`${base}/replacement`)
  assert.equal(wc.navigationHistory.canGoBack(), false)
  navigation.setActive(false)
  assert.equal(navigation.toolbar.getVisible(), false)
  assert.equal(extraWindows, 0)
  await wc.loadFile(path.join(__dirname, 'player.html'), { query: { kind: 'saver' } })
  assert.equal(await wc.executeJavaScript('typeof window.player.reset'), 'function')
  console.log('PASS: normal links, target=_blank, window.open, cross-origin Back, disabled state, bottom-right resize, assignment reset, media-mode hiding, trusted preload isolation, no extra windows')
}).then(() => finish(0)).catch((error) => { console.error(error); finish(1) })

function finish(code) {
  clearTimeout(timeout)
  if (win && !win.isDestroyed()) {
    for (const view of win.contentView.children) if (!view.webContents.isDestroyed()) view.webContents.close()
    win.destroy()
  }
  if (server) server.close()
  app.exit(code)
}
