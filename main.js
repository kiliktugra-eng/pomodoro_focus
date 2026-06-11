const { app, BrowserWindow, ipcMain, globalShortcut, powerSaveBlocker, dialog, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let powerBlockerId = null;
let isStudyMode = false;

const PASSWORD = 'Tugra10.10';

function createTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = x > 1 && x < 14 && y > 1 && y < 14;
      if (inside) { buf[i] = 108; buf[i + 1] = 92; buf[i + 2] = 231; buf[i + 3] = 255; }
      else { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Pomodoro Focus');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Göster', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { isStudyMode = false; app.quit(); } }
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024, height: 768, minWidth: 800, minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a1a',
    show: false,
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.webContents.send('close-requested');
  });

  mainWindow.on('leave-full-screen', () => {
    if (isStudyMode) mainWindow.setFullScreen(true);
  });

  mainWindow.on('minimize', () => {
    if (tray && !isStudyMode) mainWindow.hide();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
});

ipcMain.on('minimize-window', () => mainWindow?.minimize());
ipcMain.on('close-window', () => mainWindow?.close());

ipcMain.on('set-mode', (event, mode) => {
  isStudyMode = (mode === 'study');
  if (isStudyMode) { mainWindow?.show(); mainWindow?.setFullScreen(true); }
  else mainWindow?.setFullScreen(false);
});

ipcMain.on('verify-password', (event, password) => {
  if (password === PASSWORD) { isStudyMode = false; event.reply('password-result', true); }
  else event.reply('password-result', false);
});

ipcMain.on('allow-close', () => {
  isStudyMode = false;
  if (tray) { tray.destroy(); tray = null; }
  mainWindow?.destroy();
  app.quit();
});

ipcMain.on('force-quit', () => {
  isStudyMode = false;
  if (tray) { tray.destroy(); tray = null; }
  mainWindow?.destroy();
  app.quit();
});

ipcMain.on('focus-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized() || !mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    if (isStudyMode) mainWindow.setFullScreen(true);
  }
});

ipcMain.on('exit-fullscreen', () => mainWindow?.setFullScreen(false));

ipcMain.on('show-notification', (event, title, body) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body });
    n.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
    n.show();
  }
});

ipcMain.handle('select-image', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Görseller', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
  });
  if (!r.canceled && r.filePaths.length > 0) return r.filePaths[0];
  return null;
});

app.on('browser-window-created', () => {
  try { globalShortcut.register('Alt+F4', () => {}); globalShortcut.register('F11', () => {}); } catch (e) {}
});

app.on('window-all-closed', () => {
  if (powerBlockerId !== null) powerSaveBlocker.stop(powerBlockerId);
  globalShortcut.unregisterAll();
  if (tray) { tray.destroy(); tray = null; }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (powerBlockerId !== null) powerSaveBlocker.stop(powerBlockerId);
  if (tray) { tray.destroy(); tray = null; }
});