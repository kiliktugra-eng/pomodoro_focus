const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setMode: (mode) => ipcRenderer.send('set-mode', mode),
  allowClose: () => ipcRenderer.send('allow-close'),
  forceQuit: () => ipcRenderer.send('force-quit'),
  focusWindow: () => ipcRenderer.send('focus-window'),
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  showNotification: (t, b) => ipcRenderer.send('show-notification', t, b),
  onCloseRequested: (cb) => ipcRenderer.on('close-requested', () => cb()),
});