export function initTransport(player) {
  const playBtn = document.getElementById('play-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stopBtn = document.getElementById('stop-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const openBtn = document.getElementById('open-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');

  playBtn.addEventListener('click', () => player.togglePlayPause());
  pauseBtn.addEventListener('click', () => player.pause());
  stopBtn.addEventListener('click', () => player.stop());
  prevBtn.addEventListener('click', () => player.prev());
  nextBtn.addEventListener('click', () => player.next());

  openBtn.addEventListener('click', async () => {
    const paths = await window.api.openAudioFiles();
    if (paths.length === 0) return;
    const startIndex = player.tracks.length;
    await player.addPaths(paths);
    if (player.currentIndex === -1) {
      await player.start(startIndex);
    }
  });

  shuffleBtn.addEventListener('click', () => player.setShuffle(!player.shuffle));

  player.addEventListener('playstate', () => {
    playBtn.classList.toggle('active', player.isPlaying);
  });

  player.addEventListener('shuffle', () => {
    shuffleBtn.classList.toggle('active', player.shuffle);
    shuffleBtn.setAttribute('aria-pressed', String(player.shuffle));
  });
}
