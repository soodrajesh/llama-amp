# Llama Amp

A tiny retro MP3 player for the desktop, inspired by classic Winamp — original blue/silver chrome skin, a llama mascot, and a real Web Audio equalizer that actually shapes the sound (not just decorative sliders).

<img src="docs/screenshot.png" alt="Llama Amp screenshot" width="240" />

## Features

- Play/pause/stop/prev/next, seek bar with elapsed/remaining time, volume + balance
- 10-band graphic equalizer (60Hz–16kHz) with presets, a preamp, and an on/off toggle — implemented with real `BiquadFilterNode`s, not cosmetic
- Editable playlist: add via file picker or drag-and-drop from Finder, reorder, remove, save/load as JSON
- Retro spectrum-bars / oscilloscope visualizer (click it to cycle modes)
- A llama in the LCD panel that nods its head along to the music
- Shuffle: plays every track once before repeating (Fisher-Yates), not random-each-time
- Local files only — no bundled tracks, no network streaming, no telemetry

## Getting started

```bash
git clone https://github.com/soodrajesh/llama-amp.git
cd llama-amp
npm install
npm start
```

`npm start` runs the app in dev mode via Electron Forge + Vite, with hot-reload for the renderer (HTML/CSS/JS).

## Building a standalone app

```bash
npm run package   # unpacked .app in out/Llama Amp-darwin-<arch>/
npm run make       # distributable (zip on macOS)
```

**Known issue:** in some environments `npm run package` / `npm run make` hangs indefinitely partway through (after the Vite build completes, during native packaging). If that happens, package manually instead:

```bash
# from the project root, after `npm start` has produced a .vite/ build at least once
PROJECT="$(pwd)"
TEMPLATE="$PROJECT/node_modules/electron/dist/Electron.app"
APP="$PROJECT/out/Llama Amp-darwin-arm64/Llama Amp.app"

mkdir -p "$(dirname "$APP")"
ditto "$TEMPLATE" "$APP"

APPDIR="$APP/Contents/Resources/app"
mkdir -p "$APPDIR/.vite"
ditto "$PROJECT/.vite/build" "$APPDIR/.vite/build"
ditto "$PROJECT/.vite/renderer" "$APPDIR/.vite/renderer"
cp "$PROJECT/package.json" "$APPDIR/package.json"
cp "$PROJECT/assets/icon.icns" "$APP/Contents/Resources/icon.icns"

mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/Llama Amp"
PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Llama Amp" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Llama Amp" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable Llama Amp" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.llamaamp.app" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile icon.icns" "$PLIST"

codesign --force --deep --sign - "$APP"
cp -R "$APP" /Applications/
```

This is the same manual packaging method [documented by Electron itself](https://www.electronjs.org/docs/latest/tutorial/application-distribution) — it just skips whatever `electron-packager` is getting stuck on.

Since the app is ad-hoc signed (not notarized), the first launch from Finder needs **right-click → Open** to get past Gatekeeper. After that it opens normally.

If you're running commands from inside an Electron-based tool's integrated terminal (including some AI coding assistants), unset `ELECTRON_RUN_AS_NODE` first — if it's set, any Electron binary you launch from that shell runs as plain Node.js instead of a GUI app:

```bash
env -u ELECTRON_RUN_AS_NODE npm start
```

A normal Terminal or double-clicking the app from Finder is unaffected.

## Tech stack

Electron + Vite (via Electron Forge), plain HTML/CSS/JS — no frontend framework. Audio graph: `<audio>` → `MediaElementAudioSourceNode` → preamp `GainNode` → 10× `BiquadFilterNode` → `StereoPannerNode` → master `GainNode` → `AnalyserNode` → destination.

Tracks are streamed straight from disk via a custom `llama-media://` protocol (registered in `src/main/main.js`, backed by Electron's `net.fetch` on the `file://` URL with hand-rolled `Range`/`Content-Range` handling) rather than read whole into memory and copied across IPC. The renderer runs under a strict `Content-Security-Policy` and a sandboxed, context-isolated preload with a narrow `window.api` surface — no raw `ipcRenderer` exposure.

## License

MIT
