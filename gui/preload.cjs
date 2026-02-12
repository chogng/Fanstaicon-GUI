const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fantasticonGui', {
  chooseDir: async ({ title } = {}) =>
    ipcRenderer.invoke('dialog:openDir', { title }),
  chooseFile: async ({ title, filters } = {}) =>
    ipcRenderer.invoke('dialog:openFile', { title, filters }),
  setContentSize: async ({ width, height } = {}) =>
    ipcRenderer.invoke('window:setContentSize', { width, height }),
  run: async opts => ipcRenderer.invoke('fantasticon:run', opts)
});
