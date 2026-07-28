const SESSION_KEY = 'llamaamp:session';

/**
 * Runs before the other UI modules init: it sets the volume/balance slider
 * DOM values directly (rather than calling player.setVolume01/setBalance)
 * so that initVolumeBalance()'s own startup read of those sliders is what
 * actually applies them - keeping this module from needing to know anything
 * about the audio graph.
 */
export async function restoreSession(player) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (!saved) return;

  const volumeSlider = document.getElementById('volume-slider');
  const balanceSlider = document.getElementById('balance-slider');
  if (Number.isFinite(saved.volume)) volumeSlider.value = String(Math.round(saved.volume * 100));
  if (Number.isFinite(saved.balance)) balanceSlider.value = String(Math.round(saved.balance * 100));

  if (Array.isArray(saved.tracks) && saved.tracks.length > 0) {
    const candidatePaths = saved.tracks.map((t) => t?.path).filter((p) => typeof p === 'string');
    const valid = new Set(await window.api.validatePaths(candidatePaths));
    const restored = saved.tracks.filter((t) => t && valid.has(t.path));
    player.restoreTracks(restored);
    if (restored.length < saved.tracks.length) {
      player.notify(`Restored playlist (${saved.tracks.length - restored.length} file(s) missing)`);
    }
  }
}

export function initSessionPersistence(player) {
  const volumeSlider = document.getElementById('volume-slider');
  const balanceSlider = document.getElementById('balance-slider');

  function save() {
    const payload = {
      volume: player.engine.storedVolume,
      balance: player.engine.storedBalance,
      tracks: player.tracks.map((t) => ({ path: t.path, name: t.name })),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Storage full/unavailable - session just won't persist this run.
    }
  }

  player.addEventListener('playlist', save);
  player.addEventListener('trackchange', save);
  volumeSlider.addEventListener('change', save);
  balanceSlider.addEventListener('change', save);
}
