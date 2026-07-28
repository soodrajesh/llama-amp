import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  setShadeMode: (shaded) => ipcRenderer.send('window:setShade', shaded),
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFiles'),
  mediaUrlFor: (filePath) => ipcRenderer.invoke('media:urlFor', filePath),
  metadataFor: (filePath) => ipcRenderer.invoke('media:metadataFor', filePath),
  validatePaths: (filePaths) => ipcRenderer.invoke('fs:validatePaths', filePaths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  savePlaylist: (tracks) => ipcRenderer.invoke('playlist:save', tracks),
  loadPlaylist: () => ipcRenderer.invoke('playlist:load'),
  onOpenFiles: (callback) => ipcRenderer.on('open-files', (_event, filePaths) => callback(filePaths)),
});
