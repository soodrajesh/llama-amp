import { app, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.flac']);
const MEDIA_SCHEME = 'llama-media';

function isAllowedAudioPath(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Renderer-side URL for a local track, handled by the MEDIA_SCHEME protocol below. */
function toMediaUrl(filePath) {
  return `${MEDIA_SCHEME}://play/${encodeURIComponent(filePath)}`;
}

// Must run before app is ready. "stream: true" lets protocol.handle return a
// streamed Response instead of buffering the whole body first.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

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

ipcMain.handle('media:urlFor', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !isAllowedAudioPath(filePath)) return null;
  const resolved = path.resolve(filePath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) return null;
  return toMediaUrl(resolved);
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
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  // Playlist files are user-editable, so entries get the same extension check as
  // freshly added paths, and the shape is normalised rather than trusted.
  const existing = await Promise.all(
    parsed.map(async (entry) => {
      if (!entry || typeof entry.path !== 'string' || !isAllowedAudioPath(entry.path)) return null;
      const stat = await fs.stat(entry.path).catch(() => null);
      if (!stat || !stat.isFile()) return null;
      return {
        path: entry.path,
        name: typeof entry.name === 'string' && entry.name ? entry.name : path.basename(entry.path),
      };
    })
  );
  return existing.filter(Boolean);
});

app.whenReady().then(() => {
  // Streams the file straight from disk via Chromium's own file-backed fetch,
  // instead of reading it whole into a Buffer and copying it across IPC.
  protocol.handle(MEDIA_SCHEME, async (request) => {
    let filePath;
    try {
      filePath = decodeURIComponent(new URL(request.url).pathname.slice(1));
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (!isAllowedAudioPath(filePath)) {
      return new Response('Forbidden', { status: 403 });
    }
    const resolved = path.resolve(filePath);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat || !stat.isFile()) {
      return new Response('Not Found', { status: 404 });
    }
    try {
      return await net.fetch(pathToFileURL(resolved).toString(), { headers: request.headers });
    } catch {
      // net.fetch throws (rather than resolving with an error status) for an
      // unsatisfiable Range - e.g. the tail-end request a buffering <audio>
      // element issues as it nears the end of the file. Left uncaught, the
      // request never gets a response and playback hangs indefinitely
      // instead of erroring or finishing.
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    }
  });

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
