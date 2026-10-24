const path = require('path')

// A separate, trusted view keeps controls accessible above cross-origin websites.
function createNavigation({ win, contentView, WebContentsView, ipcMain }) {
  const toolbar = new WebContentsView({ webPreferences: {
    preload: path.join(__dirname, 'navigation-preload.js'),
    contextIsolation: true, sandbox: true, nodeIntegration: false,
  } })
  toolbar.setBackgroundColor('#00000000')
  win.contentView.addChildView(toolbar)
  let active = false
  const wc = contentView.webContents
  const layout = () => {
    const { width, height } = win.getContentBounds()
    toolbar.setBounds({ x: Math.max(0, width - 128), y: Math.max(0, height - 72), width: 104, height: 48 })
  }
  const update = () => {
    if (!toolbar.webContents.isDestroyed()) toolbar.webContents.send('navigation:state', wc.navigationHistory.canGoBack())
  }
  const back = (event) => {
    if (event.sender === toolbar.webContents && active && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
  }
  ipcMain.on('navigation:back', back)
  wc.setWindowOpenHandler(({ url }) => {
    if (active && /^https?:\/\//i.test(url)) wc.loadURL(url).catch(() => {})
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (active && !/^https?:\/\//i.test(url)) event.preventDefault()
  })
  wc.on('will-redirect', (event, url) => {
    if (active && !/^https?:\/\//i.test(url)) event.preventDefault()
  })
  wc.on('did-navigate', update)
  wc.on('did-navigate-in-page', update)
  wc.on('did-finish-load', update)
  toolbar.webContents.on('did-finish-load', update)
  toolbar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  toolbar.webContents.loadFile(path.join(__dirname, 'navigation.html'))
  toolbar.setVisible(false)
  win.on('resize', layout)
  win.on('closed', () => {
    ipcMain.removeListener('navigation:back', back)
    if (!toolbar.webContents.isDestroyed()) toolbar.webContents.close()
  })
  layout()
  return {
    toolbar,
    setActive(value) { active = value; toolbar.setVisible(value); update() },
    async loadWebsite(url) {
      active = true
      toolbar.setVisible(true)
      // Clear both before and after loading: an old assignment must not be reachable.
      wc.navigationHistory.clear()
      try { await wc.loadURL(url) } finally { wc.navigationHistory.clear(); update() }
    },
  }
}

module.exports = { createNavigation }
