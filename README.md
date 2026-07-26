# LlamaAmp

A tiny retro MP3 player for the desktop, inspired by classic Winamp — original blue/silver chrome skin, a llama mascot, and a real Web Audio equalizer that actually shapes the sound (not just decorative sliders).

## Features

- Play/pause/stop/prev/next, seek bar with elapsed/remaining time, volume + balance
- 10-band graphic equalizer (60Hz–16kHz) with presets, a preamp, and an on/off toggle — implemented with real `BiquadFilterNode`s, not cosmetic
- Editable playlist: add via file picker or drag-and-drop from Finder, reorder, remove, save/load as JSON
- Retro spectrum-bars / oscilloscope visualizer (click it to cycle modes)
- Local files only — no bundled tracks, no streaming, no telemetry

## Getting started

```bash
git clone https://github.com/soodrajesh/winamp-llama-player.git
cd winamp-llama-player
npm install
npm start
```

`npm start` runs the app in dev mode via Electron Forge + Vite, with hot-reload for the renderer (HTML/CSS/JS).

## Building a standalone app

```bash
npm run package   # unpacked .app in out/LlamaAmp-darwin-<arch>/
npm run make       # distributable (zip on macOS)
```

**Known issue:** in some environments `npm run package` / `npm run make` hangs indefinitely partway through (after the Vite build completes, during native packaging). If that happens, package manually instead:

```bash
# from the project root, after `npm start` has produced a .vite/ build at least once
PROJECT="$(pwd)"
TEMPLATE="$PROJECT/node_modules/electron/dist/Electron.app"
APP="$PROJECT/out/LlamaAmp-darwin-arm64/LlamaAmp.app"

mkdir -p "$(dirname "$APP")"
ditto "$TEMPLATE" "$APP"

APPDIR="$APP/Contents/Resources/app"
mkdir -p "$APPDIR/.vite"
ditto "$PROJECT/.vite/build" "$APPDIR/.vite/build"
ditto "$PROJECT/.vite/renderer" "$APPDIR/.vite/renderer"
cp "$PROJECT/package.json" "$APPDIR/package.json"

mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/LlamaAmp"
PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName LlamaAmp" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable LlamaAmp" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.llamaamp.app" "$PLIST"

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

## License

MIT
