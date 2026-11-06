// 12 Nights digital: Windows host app. Starts the local game server and shows the shared monitor full screen.
'use strict';
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
process.env.SAVE_DIR = process.env.SAVE_DIR || path.join(app.getPath('documents'), '12shab');
let win;
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  let srv;
  if (process.platform === 'win32') await firewall();
  try { srv = require('../server/server.js'); await srv.start(); }
  catch (e) { dialog.showErrorBox('۱۲ شب', 'میزبان بازی اجرا نشد:\n' + e.message + '\nشاید برنامه دو بار باز شده است.'); app.quit(); return; }
  win = new BrowserWindow({ width: 1600, height: 900, fullscreen: true, backgroundColor: '#0b0c1d', title: '۱۲ شب', autoHideMenuBar: true, webPreferences: { contextIsolation: true, autoplayPolicy: 'no-user-gesture-required' } });
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

// Windows Firewall (Farshad 2026-11-06: phones on the same Wi-Fi could not connect). The first-run «allow access» prompt
// is easily missed behind the full-screen window, «Cancel» there creates a BLOCK rule for the app, and on a «Public»
// network the default allow is not enough. So the app adds its own inbound rules for the game ports on every profile
// once, removing any block rule Windows made for it. This needs one Windows admin (UAC) confirmation.
function sh(cmd) { return new Promise(r => require('child_process').exec(cmd, { windowsHide: true }, (e, out) => r({ ok: !e, out: String(out || '') }))); }
async function firewall() {
  const fs = require('fs'), flag = path.join(process.env.SAVE_DIR, 'firewall-ok');
  try { if (fs.existsSync(flag)) return; } catch (e) {}
  const has = await sh('netsh advfirewall firewall show rule name="12Nights TCP"');
  if (has.ok && /12Nights/.test(has.out)) { try { fs.mkdirSync(process.env.SAVE_DIR, { recursive: true }); fs.writeFileSync(flag, '1'); } catch (e) {} return; }
  const r = await dialog.showMessageBox({ type: 'info', buttons: ['اجازه بده', 'بعداً'], defaultId: 0, title: '۱۲ شب',
    message: 'برای اینکه گوشی‌ها بتوانند به این کامپیوتر وصل شوند، باید در دیوار آتش ویندوز اجازهٔ شبکه داده شود.',
    detail: 'بعد از زدن «اجازه بده» ویندوز یک بار تأیید مدیر (UAC) می‌خواهد؛ «Yes» را بزن. این کار فقط یک بار لازم است.' });
  if (r.response !== 0) return;
  // the commands go into a small .cmd file that Windows runs once as administrator (no nested quoting)
  const exe = process.execPath, cmdf = path.join(app.getPath('temp'), '12nights-firewall.cmd');
  const lines = ['@echo off', 'chcp 65001 >nul',
    `netsh advfirewall firewall delete rule name=all program="${exe}"`,
    'netsh advfirewall firewall delete rule name="12Nights TCP"', 'netsh advfirewall firewall delete rule name="12Nights UDP"', 'netsh advfirewall firewall delete rule name="12Nights App"',
    'netsh advfirewall firewall add rule name="12Nights TCP" dir=in action=allow protocol=TCP localport=47130 profile=any',
    'netsh advfirewall firewall add rule name="12Nights UDP" dir=in action=allow protocol=UDP localport=47131 profile=any',
    `netsh advfirewall firewall add rule name="12Nights App" dir=in action=allow program="${exe}" profile=any`];
  try { fs.writeFileSync(cmdf, lines.join('\r\n') + '\r\n'); } catch (e) { return; }
  await sh(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '${cmdf.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait"`);
  const ok = await sh('netsh advfirewall firewall show rule name="12Nights TCP"');
  if (ok.ok && /12Nights/.test(ok.out)) { try { fs.mkdirSync(process.env.SAVE_DIR, { recursive: true }); fs.writeFileSync(flag, '1'); } catch (e) {} }
  else dialog.showMessageBox({ type: 'warning', title: '۱۲ شب', message: 'اجازهٔ دیوار آتش داده نشد.', detail: 'اگر گوشی‌ها وصل نشدند، برنامه را ببند و دوباره باز کن و «اجازه بده» و سپس «Yes» را بزن.' });
}
