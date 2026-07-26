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

/**
 * net.fetch(file://...) correctly slices the body for a Range request but
 * never reports it - it comes back as a bare 200 with no Content-Length or
 * Content-Range, so <audio> has no way to tell the resource is seekable at
 * all and treats everything past what it has already buffered as
 * unseekable. Range has to be parsed and the response metadata constructed
 * by hand instead of trusting the passthrough.
 */
function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return 'unsatisfiable';
  const [, startStr, endStr] = match;
  let start;
  let end;
  if (startStr === '') {
    if (endStr === '') return 'unsatisfiable';
    start = Math.max(0, size - Number(endStr));
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? size - 1 : Math.min(Number(endStr), size - 1);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start < 0 || start >= size) {
    return 'unsatisfiable';
  }
  return { start, end };
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
    const unsatisfiable = () =>
      new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${stat.size}`, 'Access-Control-Allow-Origin': '*' },
      });

    const range = parseRange(request.headers.get('range'), stat.size);
    if (range === 'unsatisfiable') return unsatisfiable();

    let res;
    try {
      res = await net.fetch(pathToFileURL(resolved).toString(), { headers: request.headers });
    } catch {
      // Defensive fallback: parseRange already rejects anything unsatisfiable
      // above, so a throw here means net.fetch failed for some other reason.
      return unsatisfiable();
    }

    // The renderer's <audio> element sets crossOrigin="anonymous" so it can be
    // routed through Web Audio (createMediaElementSource); without a CORS
    // header here the browser treats the source as tainted and silently
    // zeroes every sample reaching the graph - playback looks normal
    // (currentTime advances) but nothing is audible.
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');

    if (range) {
      headers.set('Content-Length', String(range.end - range.start + 1));
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      return new Response(res.body, { status: 206, statusText: 'Partial Content', headers });
    }
    headers.set('Content-Length', String(stat.size));
    return new Response(res.body, { status: 200, statusText: 'OK', headers });
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
