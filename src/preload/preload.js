import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFiles'),
  mediaUrlFor: (filePath) => ipcRenderer.invoke('media:urlFor', filePath),
  validatePaths: (filePaths) => ipcRenderer.invoke('fs:validatePaths', filePaths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  savePlaylist: (tracks) => ipcRenderer.invoke('playlist:save', tracks),
  loadPlaylist: () => ipcRenderer.invoke('playlist:load'),
});
