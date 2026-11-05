// 12 Nights digital: Windows host app. Starts the local game server and shows the shared monitor full screen.
'use strict';
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
process.env.SAVE_DIR = process.env.SAVE_DIR || path.join(app.getPath('documents'), '12shab');
let win;
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  let srv;
  try { srv = require('../server/server.js'); await srv.start(); }
  catch (e) { dialog.showErrorBox('۱۲ شب', 'میزبان بازی اجرا نشد:\n' + e.message + '\nشاید برنامه دو بار باز شده است.'); app.quit(); return; }
  win = new BrowserWindow({ width: 1600, height: 900, fullscreen: true, backgroundColor: '#0b0c1d', title: '۱۲ شب', autoHideMenuBar: true, webPreferences: { contextIsolation: true } });
  win.loadURL('http://127.0.0.1:' + srv.PORT + '/m');
  win.webContents.on('before-input-event', (e, inp) => {
    if (inp.type !== 'keyDown') return;
    if (inp.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (inp.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
    if (inp.key === 'F5') win.reload();
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
});
app.on('window-all-closed', () => app.quit());
