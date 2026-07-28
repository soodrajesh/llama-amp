const VOLUME_STEP = 0.05;

/** Global playback shortcuts - only fire when nothing (slider, button, etc.) already has focus. */
export function initKeyboard(player) {
  const volumeSlider = document.getElementById('volume-slider');

  function adjustVolume(delta) {
    const next = Math.min(100, Math.max(0, Number(volumeSlider.value) + delta * 100));
    volumeSlider.value = String(next);
    volumeSlider.dispatchEvent(new Event('input'));
    volumeSlider.dispatchEvent(new Event('change'));
  }

  window.addEventListener('keydown', (e) => {
    if (e.target !== document.body) return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        player.togglePlayPause();
        break;
      case 'ArrowRight':
        player.next();
        break;
      case 'ArrowLeft':
        player.prev();
        break;
      case 'ArrowUp':
        e.preventDefault();
        adjustVolume(VOLUME_STEP);
        break;
      case 'ArrowDown':
        e.preventDefault();
        adjustVolume(-VOLUME_STEP);
        break;
      case 'KeyS':
        player.stop();
        break;
    }
  });
}
