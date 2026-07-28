const AUDIO_EXT_RE = /\.(mp3|m4a|wav|ogg|oga|flac|opus|weba)$/i;

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
      const dropped = [...(e.dataTransfer?.files ?? [])];
      const files = dropped.filter((f) => AUDIO_EXT_RE.test(f.name));
      if (files.length === 0) {
        if (dropped.length > 0) player.notify('No supported audio files in that drop');
        return;
      }
      const paths = files.map((file) => window.api.getPathForFile(file));
      await player.openPaths(paths);
    });
  });
}
