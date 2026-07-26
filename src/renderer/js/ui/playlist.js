export function initPlaylist(player) {
  const list = document.getElementById('pl-list');
  const addBtn = document.getElementById('pl-add-btn');
  const removeBtn = document.getElementById('pl-remove-btn');
  const saveBtn = document.getElementById('pl-save-btn');
  const loadBtn = document.getElementById('pl-load-btn');
  const clearBtn = document.getElementById('pl-clear-btn');

  let selectedIndex = -1;
  let dragFromIndex = -1;

  function render() {
    list.innerHTML = '';
    player.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.className = 'pl-item';
      li.draggable = true;
      if (index === selectedIndex) li.classList.add('selected');
      if (index === player.currentIndex) li.classList.add('playing');

      const idx = document.createElement('span');
      idx.className = 'pl-index';
      idx.textContent = String(index + 1) + '.';

      const name = document.createElement('span');
      name.className = 'pl-name';
      name.textContent = track.name;

      li.append(idx, name);

      li.addEventListener('click', () => {
        selectedIndex = index;
        render();
      });
      li.addEventListener('dblclick', () => player.playIndex(index));

      li.addEventListener('dragstart', () => {
        dragFromIndex = index;
        li.classList.add('dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('dragging'));
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragFromIndex === -1) return;
        player.reorder(dragFromIndex, index);
        dragFromIndex = -1;
      });

      list.appendChild(li);
    });
  }

  addBtn.addEventListener('click', async () => {
    const paths = await window.api.openAudioFiles();
    if (paths.length > 0) await player.addPaths(paths);
  });

  removeBtn.addEventListener('click', () => {
    if (selectedIndex === -1) return;
    player.removeAt(selectedIndex);
    selectedIndex = -1;
  });

  clearBtn.addEventListener('click', () => {
    selectedIndex = -1;
    player.clear();
  });

  saveBtn.addEventListener('click', () => player.savePlaylist());
  loadBtn.addEventListener('click', () => player.loadPlaylist());

  player.addEventListener('playlist', render);
  player.addEventListener('trackchange', render);
  player.addEventListener('playstate', render);

  render();
}
