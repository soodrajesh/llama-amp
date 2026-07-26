const AUDIO_EXT_RE = /\.(mp3|m4a|wav|ogg|flac)$/i;

export function initDragDrop(player) {
  const dropzone = document.getElementById('pl-dropzone');
  const list = document.getElementById('pl-list');
  const targets = [dropzone, list];

  function highlight(on) {
    dropzone.classList.toggle('drag-over', on);
  }

  targets.forEach((el) => {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      highlight(true);
    });
    el.addEventListener('dragleave', () => highlight(false));
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      highlight(false);
      const files = [...(e.dataTransfer?.files ?? [])].filter((f) => AUDIO_EXT_RE.test(f.name));
      if (files.length === 0) return;
      const paths = files.map((file) => window.api.getPathForFile(file));
      const startIndex = player.tracks.length;
      await player.addPaths(paths);
      if (player.currentIndex === -1) {
        await player.playIndex(startIndex);
      }
    });
  });
}
