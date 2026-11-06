const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

if (!app.requestSingleInstanceLock()) { app.quit(); }
let win;
function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1180, height: 820, minWidth: 420, minHeight: 600, title: 'VerTech Admin', backgroundColor: '#f3f5fa', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => app.quit());

function sendUpd(state, extra) { if (win && !win.isDestroyed()) win.webContents.send('upd', Object.assign({ state }, extra || {})); }
function setupUpdater() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', i => sendUpd('available', { version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpd('none'));
  autoUpdater.on('update-downloaded', i => sendUpd('downloaded', { version: i.version }));
  autoUpdater.on('error', e => sendUpd('error', { message: String((e && e.message) || e) }));
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 6000);
}
ipcMain.handle('check-update', async () => {
  if (!app.isPackaged) return { state: 'dev' };
  try { await autoUpdater.checkForUpdates(); return { state: 'checking' }; } catch (e) { return { state: 'error', message: String((e && e.message) || e) }; }
});
ipcMain.handle('install-update', () => { autoUpdater.quitAndInstall(true, true); });
