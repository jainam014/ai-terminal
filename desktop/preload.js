const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (apiKey, provider) => ipcRenderer.invoke('set-api-key', apiKey, provider),
  getProviderConfig: () => ipcRenderer.invoke('get-provider-config'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  onFirstRunComplete: (callback) => {
    ipcRenderer.on('first-run-complete', callback);
  },
  sendFirstRunComplete: () => ipcRenderer.send('first-run-complete'),
});
