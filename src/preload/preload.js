import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFiles'),
  readAudioFile: (filePath) => ipcRenderer.invoke('fs:readAudioFile', filePath),
  validatePaths: (filePaths) => ipcRenderer.invoke('fs:validatePaths', filePaths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  savePlaylist: (tracks) => ipcRenderer.invoke('playlist:save', tracks),
  loadPlaylist: () => ipcRenderer.invoke('playlist:load'),
});
