const { contextBridge, ipcRenderer } = require('electron');
// ce poate cere pagina de la programul de Windows: PDF cu previzualizare + actualizări automate
contextBridge.exposeInMainWorld('trikkerElectron', {
  printPdf: () => ipcRenderer.invoke('print-pdf'),
  sendMail: o => ipcRenderer.invoke('send-mail', o),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdate: cb => ipcRenderer.on('upd', (_e, d) => cb(d))
});
