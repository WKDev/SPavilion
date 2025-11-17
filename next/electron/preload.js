const { contextBridge, ipcRenderer } = require('electron');

// Electron API를 렌더러 프로세스에 안전하게 노출
contextBridge.exposeInMainWorld('electron', {
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
});

