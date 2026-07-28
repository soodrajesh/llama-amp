import fs from 'node:fs';
import path from 'node:path';

/** Debounced-write helper so drag-resize doesn't hammer disk on every 'resize' tick. */
export function createWindowStateStore(userDataDir) {
  const filePath = path.join(userDataDir, 'window-state.json');

  function load() {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y) &&
        Number.isFinite(parsed.width) &&
        Number.isFinite(parsed.height)
      ) {
        return parsed;
      }
    } catch {
      // No saved state yet, or it's corrupt - fall through to defaults.
    }
    return null;
  }

  let pending = null;
  let timer = null;
  function save(bounds) {
    pending = bounds;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        fs.writeFileSync(filePath, JSON.stringify(pending));
      } catch {
        // Best-effort; losing remembered window position isn't worth surfacing to the user.
      }
    }, 500);
  }

  function saveNow(bounds) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    try {
      fs.writeFileSync(filePath, JSON.stringify(bounds));
    } catch {
      // Best-effort, see above.
    }
  }

  return { load, save, saveNow };
}

/** A remembered position from a display that's since been unplugged shouldn't strand the window off-screen. */
export function boundsAreOnScreen(bounds, displays) {
  return displays.some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}
