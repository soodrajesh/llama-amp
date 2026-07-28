export function initPlaylist(player) {
  const list = document.getElementById('pl-list');
  const addBtn = document.getElementById('pl-add-btn');
  const removeBtn = document.getElementById('pl-remove-btn');
  const saveBtn = document.getElementById('pl-save-btn');
  const loadBtn = document.getElementById('pl-load-btn');
  const clearBtn = document.getElementById('pl-clear-btn');

  let selectedIndex = -1;
  let dragFromIndex = -1;

  list.tabIndex = 0;
  list.setAttribute('role', 'listbox');

  // Full DOM rebuild: only needed when the track list itself changes shape.
  function renderList() {
    list.innerHTML = '';
    player.tracks.forEach((track, index) => {
      const li = document.createElement('li');
      li.className = 'pl-item';
      li.draggable = true;
      li.dataset.index = String(index);
      li.id = `pl-item-${index}`;
      li.setAttribute('role', 'option');

      const idx = document.createElement('span');
      idx.className = 'pl-index';
      idx.textContent = String(index + 1) + '.';

      const name = document.createElement('span');
      name.className = 'pl-name';
      name.textContent = track.name;

      li.append(idx, name);
      list.appendChild(li);
    });
    updateHighlights();
  }

  // Play/pause and track-change only need class toggles on existing rows, not a rebuild.
  function updateHighlights() {
    list.querySelectorAll('.pl-item').forEach((li) => {
      const index = Number(li.dataset.index);
      li.classList.toggle('selected', index === selectedIndex);
      li.classList.toggle('playing', index === player.currentIndex);
      li.setAttribute('aria-selected', String(index === selectedIndex));
    });
    list.setAttribute('aria-activedescendant', selectedIndex === -1 ? '' : `pl-item-${selectedIndex}`);
  }

  // Delegated listeners on the <ul> instead of six per row, so renderList() doesn't
  // need to re-attach anything and updateHighlights() never touches listeners at all.
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.pl-item');
    if (!li) return;
    selectedIndex = Number(li.dataset.index);
    updateHighlights();
  });

  list.addEventListener('dblclick', (e) => {
    const li = e.target.closest('.pl-item');
    if (li) player.playIndex(Number(li.dataset.index));
  });

  list.addEventListener('keydown', (e) => {
    if (player.tracks.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const base = selectedIndex === -1 ? (delta === 1 ? -1 : player.tracks.length) : selectedIndex;
      selectedIndex = Math.min(player.tracks.length - 1, Math.max(0, base + delta));
      updateHighlights();
      list.querySelector(`#pl-item-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && selectedIndex !== -1) {
      player.playIndex(selectedIndex);
    }
  });

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.pl-item');
    if (!li) return;
    dragFromIndex = Number(li.dataset.index);
    li.classList.add('dragging');
  });

  list.addEventListener('dragend', (e) => {
    e.target.closest('.pl-item')?.classList.remove('dragging');
  });

  list.addEventListener('dragover', (e) => {
    if (e.target.closest('.pl-item')) e.preventDefault();
  });

  list.addEventListener('drop', (e) => {
    const li = e.target.closest('.pl-item');
    if (!li || dragFromIndex === -1) return;
    e.preventDefault();
    player.reorder(dragFromIndex, Number(li.dataset.index));
    dragFromIndex = -1;
  });

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

  player.addEventListener('playlist', renderList);
  player.addEventListener('trackchange', updateHighlights);
  player.addEventListener('playstate', updateHighlights);

  renderList();
}
