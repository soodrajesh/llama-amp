import { app, BrowserWindow, dialog, ipcMain, protocol, net, screen, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseFile } from 'music-metadata';
import started from 'electron-squirrel-startup';
import { AUDIO_EXTENSIONS, isAllowedAudioPath, audioPathsFromArgv, parseRange } from './mediaUtils.js';
import { createWindowStateStore, boundsAreOnScreen } from './windowState.js';
import { serializeM3U, parseM3U, serializeJSON, parseJSON } from './playlistFormats.js';

if (started) {
  app.quit();
}

const MEDIA_SCHEME = 'llama-media';
const DEFAULT_WIDTH = 275;
const DEFAULT_HEIGHT = 480;
const MIN_WIDTH = 275;
const MIN_HEIGHT = 116;
const SHADE_HEIGHT = 66;

/** Renderer-side URL for a local track, handled by the MEDIA_SCHEME protocol below. */
function toMediaUrl(filePath) {
  return `${MEDIA_SCHEME}://play/${encodeURIComponent(filePath)}`;
}

async function expandToAudioFiles(paths) {
  const results = [];
  for (const entryPath of paths) {
    const stat = await fs.stat(entryPath).catch(() => null);
    if (!stat) continue;
    if (stat.isFile()) {
      if (isAllowedAudioPath(entryPath)) results.push(entryPath);
      continue;
    }
    if (!stat.isDirectory()) continue;
    const entries = await fs.readdir(entryPath, { withFileTypes: true, recursive: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(entry.parentPath ?? entry.path ?? entryPath, entry.name);
      if (isAllowedAudioPath(full)) results.push(full);
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

// Files the OS wants opened before the renderer has a listener attached (cold
// launch-with-file) are queued here and flushed once the window signals ready.
let mainWindow = null;
let rendererReady = false;
let pendingOpenPaths = [];
let windowStateStore = null;
let isShaded = false;
let preShadeHeight = DEFAULT_HEIGHT;

function sendOpenPaths(paths) {
  if (paths.length === 0) return;
  if (rendererReady && mainWindow) {
    mainWindow.webContents.send('open-files', paths);
  } else {
    pendingOpenPaths.push(...paths);
  }
}

// macOS delivers launch-with-file as an Apple Event, not argv, and can fire
// before 'ready' on cold launch - so this has to be registered at module load,
// not inside whenReady().
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (isAllowedAudioPath(filePath)) {
    sendOpenPaths([path.resolve(filePath)]);
  }
});

// Windows/Linux have no open-file event; a second launch-with-file just starts
// a new process, so the running instance has to be handed the path via this.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    sendOpenPaths(audioPathsFromArgv(argv));
  });
}

// A renderer compromised via a future dependency shouldn't be able to pop
// windows or navigate the app away from its own bundled page.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (navEvent) => navEvent.preventDefault());
});

// Must run before app is ready. "stream: true" lets protocol.handle return a
// streamed Response instead of buffering the whole body first.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

const createWindow = () => {
  rendererReady = false;
  isShaded = false;

  const saved = windowStateStore?.load();
  const useSaved = saved && boundsAreOnScreen(saved, screen.getAllDisplays());
  preShadeHeight = useSaved ? saved.height : DEFAULT_HEIGHT;

  mainWindow = new BrowserWindow({
    x: useSaved ? saved.x : undefined,
    y: useSaved ? saved.y : undefined,
    width: useSaved ? saved.width : DEFAULT_WIDTH,
    height: useSaved ? saved.height : DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
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

  const persistBounds = () => {
    if (isShaded) return;
    windowStateStore?.save(mainWindow.getBounds());
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('close', () => {
    if (!isShaded) windowStateStore?.saveNow(mainWindow.getBounds());
  });

  mainWindow.webContents.once('did-finish-load', () => {
    rendererReady = true;
    sendOpenPaths(pendingOpenPaths);
    pendingOpenPaths = [];
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return mainWindow;
};

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:setShade', (event, shaded) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const [width] = win.getContentSize();
  if (shaded && !isShaded) {
    const [, height] = win.getContentSize();
    preShadeHeight = height;
    isShaded = true;
    win.setMinimumSize(MIN_WIDTH, SHADE_HEIGHT);
    win.setContentSize(width, SHADE_HEIGHT);
  } else if (!shaded && isShaded) {
    isShaded = false;
    win.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
    win.setContentSize(width, preShadeHeight);
  }
});

ipcMain.handle('dialog:openAudioFiles', async () => {
  // macOS lets a single panel pick files or folders together; Windows/Linux
  // dialogs generally honor only one of the two, so folder-add there may
  // need a second pass - not verified on those platforms.
  const result = await dialog.showOpenDialog({
    title: 'Open Audio Files or Folders',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: [...AUDIO_EXTENSIONS].map((e) => e.slice(1)) }],
  });
  if (result.canceled) return [];
  return expandToAudioFiles(result.filePaths);
});

ipcMain.handle('media:urlFor', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !isAllowedAudioPath(filePath)) return null;
  const resolved = path.resolve(filePath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat || !stat.isFile()) return null;
  try {
    app.addRecentDocument(resolved);
  } catch {
    // macOS/Windows only; harmless no-op elsewhere.
  }
  return toMediaUrl(resolved);
});

ipcMain.handle('media:metadataFor', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !isAllowedAudioPath(filePath)) return null;
  const resolved = path.resolve(filePath);
  try {
    const { common } = await parseFile(resolved);
    const picture = common.picture?.[0];
    return {
      title: common.title || null,
      artist: common.artist || null,
      album: common.album || null,
      artwork: picture ? `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}` : null,
    };
  } catch {
    // Unreadable/corrupt tags shouldn't block playback - just no metadata.
    return null;
  }
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
    filters: [
      { name: 'Playlist JSON', extensions: ['json'] },
      { name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] },
    ],
  });
  if (result.canceled || !result.filePath) return false;
  const ext = path.extname(result.filePath).toLowerCase();
  const content = ext === '.m3u' || ext === '.m3u8' ? serializeM3U(tracks) : serializeJSON(tracks);
  await fs.writeFile(result.filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('playlist:load', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Load Playlist',
    properties: ['openFile'],
    filters: [{ name: 'Playlist', extensions: ['json', 'm3u', 'm3u8'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const raw = await fs.readFile(filePath, 'utf-8');

  let entries;
  if (ext === '.m3u' || ext === '.m3u8') {
    entries = parseM3U(raw, path.dirname(filePath));
  } else {
    try {
      entries = parseJSON(raw);
    } catch {
      entries = [];
    }
  }

  // Playlist files are user-editable, so entries get the same extension check as
  // freshly added paths, and the shape is normalised rather than trusted.
  const checked = await Promise.all(
    entries.map(async (entry) => {
      if (!entry || typeof entry.path !== 'string' || !isAllowedAudioPath(entry.path)) return null;
      const stat = await fs.stat(entry.path).catch(() => null);
      if (!stat || !stat.isFile()) return null;
      return {
        path: entry.path,
        name: typeof entry.name === 'string' && entry.name ? entry.name : path.basename(entry.path),
      };
    })
  );
  const tracks = checked.filter(Boolean);
  return { tracks, skipped: entries.length - tracks.length };
});

app.whenReady().then(() => {
  windowStateStore = createWindowStateStore(app.getPath('userData'));

  // Strip the default menu (and its DevTools/Reload accelerators) from shipped
  // builds only - dev mode via `npm start` keeps it for debugging. macOS keeps
  // a minimal app menu so Cmd+Q still works with no menu bar visible.
  if (app.isPackaged) {
    Menu.setApplicationMenu(
      process.platform === 'darwin' ? Menu.buildFromTemplate([{ label: app.name, submenu: [{ role: 'quit' }] }]) : null
    );
  }

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
  // Cold launch-with-file on Windows/Linux arrives as an argv entry rather
  // than an event; macOS's equivalent is the 'open-file' listener above.
  sendOpenPaths(audioPathsFromArgv(process.argv));

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
