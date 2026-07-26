import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac']);
const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

function isAllowedAudioPath(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 275,
    height: 480,
    minWidth: 275,
    minHeight: 116,
    frame: false,
    resizable: true,
    backgroundColor: '#1c1f26',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return mainWindow;
};

ipcMain.handle('dialog:openAudioFiles', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Audio Files',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: [...AUDIO_EXTENSIONS].map((e) => e.slice(1)) }],
  });
  if (result.canceled) return [];
  return result.filePaths.filter(isAllowedAudioPath);
});

ipcMain.handle('fs:readAudioFile', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !isAllowedAudioPath(filePath)) {
    throw new Error('Rejected: not an allowed audio file path');
  }
  const resolved = path.resolve(filePath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error('Rejected: file does not exist');
  }
  const buffer = await fs.readFile(resolved);
  const ext = path.extname(resolved).toLowerCase();
  return { buffer, mimeType: MIME_TYPES[ext] ?? 'application/octet-stream' };
});

ipcMain.handle('fs:validatePaths', async (_event, filePaths) => {
  const checks = await Promise.all(
    (filePaths ?? []).map(async (filePath) => {
      if (typeof filePath !== 'string' || !isAllowedAudioPath(filePath)) return null;
      const stat = await fs.stat(filePath).catch(() => null);
      return stat && stat.isFile() ? filePath : null;
    })
  );
  return checks.filter(Boolean);
});

ipcMain.handle('playlist:save', async (_event, tracks) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Playlist',
    defaultPath: 'playlist.json',
    filters: [{ name: 'Playlist', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  await fs.writeFile(result.filePath, JSON.stringify(tracks, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('playlist:load', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Load Playlist',
    properties: ['openFile'],
    filters: [{ name: 'Playlist', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const raw = await fs.readFile(result.filePaths[0], 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const existing = await Promise.all(
    parsed.map(async (track) => {
      const stat = await fs.stat(track.path).catch(() => null);
      return stat && stat.isFile() ? track : null;
    })
  );
  return existing.filter(Boolean);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
