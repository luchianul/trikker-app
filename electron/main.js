const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// o singură fereastră: dacă deschizi aplicația a doua oară, o aduce în față pe prima
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win;
function createWindow() {
  Menu.setApplicationMenu(null);                       // fără bara de meniu
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    backgroundColor: '#ffffff', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.maximize();
  win.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
  // linkurile externe se deschid în browser, nu în aplicație
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
