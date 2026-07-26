import { Player } from './player.js';
import { initTransport } from './ui/transport.js';
import { initSeekbar } from './ui/seekbar.js';
import { initVolumeBalance } from './ui/volumeBalance.js';
import { initEqualizerPanel } from './ui/equalizerPanel.js';
import { initPlaylist } from './ui/playlist.js';
import { initDragDrop } from './ui/dragDrop.js';
import { initLlama } from './ui/llama.js';
import { initVisualizer } from './ui/visualizer.js';
import { initLlamaDancer } from './ui/llamaDancer.js';

const player = new Player();

initTransport(player);
initSeekbar(player);
initVolumeBalance(player);
initEqualizerPanel(player);
initPlaylist(player);
initDragDrop(player);
initLlama(player);
initVisualizer(player);
initLlamaDancer(player);

const eqPanel = document.getElementById('eq-panel');
const plPanel = document.getElementById('pl-panel');
const toggleEqBtn = document.getElementById('toggle-eq');
const togglePlBtn = document.getElementById('toggle-pl');
const closeBtn = document.getElementById('close-btn');

toggleEqBtn.addEventListener('click', () => {
  eqPanel.hidden = !eqPanel.hidden;
  toggleEqBtn.classList.toggle('active', !eqPanel.hidden);
});

togglePlBtn.addEventListener('click', () => {
  plPanel.hidden = !plPanel.hidden;
  togglePlBtn.classList.toggle('active', !plPanel.hidden);
});

closeBtn.addEventListener('click', () => window.close());

// Start with the playlist visible since there's no audio loaded yet.
plPanel.hidden = false;
togglePlBtn.classList.add('active');
