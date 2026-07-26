export function initLlama(player) {
  const llamaBtn = document.getElementById('llama-btn');
  const aboutOverlay = document.getElementById('about-overlay');
  const aboutCloseBtn = document.getElementById('about-close-btn');

  player.addEventListener('playstate', () => {
    llamaBtn.classList.toggle('bobbing', player.isPlaying);
  });

  llamaBtn.addEventListener('click', () => {
    aboutOverlay.hidden = false;
  });
  aboutCloseBtn.addEventListener('click', () => {
    aboutOverlay.hidden = true;
  });
  aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) aboutOverlay.hidden = true;
  });
}
