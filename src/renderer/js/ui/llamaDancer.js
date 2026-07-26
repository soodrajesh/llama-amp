export function initLlamaDancer(player) {
  const dancer = document.getElementById('llama-dancer');

  player.addEventListener('playstate', () => {
    dancer.classList.toggle('playing', player.isPlaying);
  });
}
