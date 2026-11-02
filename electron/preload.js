const { contextBridge, ipcRenderer } = require('electron');
// pagina poate cere: „fă PDF din ce e pe ecran și deschide-l”
contextBridge.exposeInMainWorld('trikkerElectron', { printPdf: () => ipcRenderer.invoke('print-pdf') });
