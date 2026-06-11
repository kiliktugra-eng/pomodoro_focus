const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setMode: (mode) => ipcRenderer.send('set-mode', mode),
  verifyPassword: (p) => ipcRenderer.send('verify-password', p),
  allowClose: () => ipcRenderer.send('allow-close'),
  forceQuit: () => ipcRenderer.send('force-quit'),
  focusWindow: () => ipcRenderer.send('focus-window'),
  exitFullscreen: () => ipcRenderer.send('exit-fullscreen'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  showNotification: (t, b) => ipcRenderer.send('show-notification', t, b),
  onCloseRequested: (cb) => ipcRenderer.on('close-requested', () => cb()),
  onPasswordResult: (cb) => ipcRenderer.on('password-result', (_, r) => cb(r)),
});