const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('player', {
  submit: (payload) => ipcRenderer.invoke('overlay:submit', payload),
  cancel: () => ipcRenderer.send('overlay:cancel'),
  reset: () => ipcRenderer.send('player:reset'),
  quit: () => ipcRenderer.send('player:quit'),
  onShow: (callback) => ipcRenderer.on('overlay:show', (_event, state) => callback(state)),
  onControl: (callback) => ipcRenderer.on('player:control', (_event, command) => callback(command)),
})
