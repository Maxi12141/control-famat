const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('famatEscritorio', {
  info: () => ipcRenderer.invoke('famat-info'),
  abrirCarpeta: () => ipcRenderer.invoke('famat-abrir-carpeta'),
  buscar: () => ipcRenderer.invoke('famat-buscar'),
})
