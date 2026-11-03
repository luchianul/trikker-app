const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// păstrăm folderul de date vechi („Trikker”), ca proiectele locale să rămână după schimbarea numelui
app.setPath('userData', path.join(app.getPath('appData'), 'Trikker'));

// o singură fereastră: dacă deschizi aplicația a doua oară, o aduce în față pe prima
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win;
function createWindow() {
  Menu.setApplicationMenu(null);                       // fără bara de meniu
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'VerTech', backgroundColor: '#ffffff', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') }
  });
  win.maximize();
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // linkurile externe se deschid în browser, nu în aplicație
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => app.quit());

// PDF cu previzualizare: facem PDF-ul din pagină (cu stilul de tipar) și îl deschidem în programul de PDF al calculatorului
ipcMain.handle('print-pdf', async (event) => {
  const wc = event.sender;
  const data = await wc.printToPDF({ preferCSSPageSize: true, printBackground: true });
  const f = path.join(app.getPath('temp'), 'VerTech-' + Date.now() + '.pdf');
  fs.writeFileSync(f, data);
  const err = await shell.openPath(f);
  if (err) throw new Error(err);
  return f;
});

// Actualizări automate din GitHub Releases: se descarcă în fundal, se instalează când repornești (sau la închidere)
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
