const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('trikkerElectron', {
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdate: cb => ipcRenderer.on('upd', (_e, d) => cb(d))
});
