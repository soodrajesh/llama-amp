function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function initSeekbar(player) {
  const seekBar = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  const timeMode = document.getElementById('time-mode');
  const marquee = document.getElementById('marquee');
  const marqueeText = document.getElementById('marquee-text');

  let userSeeking = false;
  let showRemaining = false;

  seekBar.addEventListener('input', () => {
    userSeeking = true;
  });
  seekBar.addEventListener('change', () => {
    player.seekToRatio(Number(seekBar.value) / 1000);
    userSeeking = false;
  });

  timeDisplay.addEventListener('click', () => {
    showRemaining = !showRemaining;
    timeMode.textContent = showRemaining ? 'REMAINING' : 'ELAPSED';
    updateTime();
  });

  function updateTime() {
    const { currentTime, duration } = player.audioEl;
    if (!userSeeking && Number.isFinite(duration) && duration > 0) {
      seekBar.value = String(Math.round((currentTime / duration) * 1000));
    }
    const shown = showRemaining && Number.isFinite(duration) ? duration - currentTime : currentTime;
    timeDisplay.textContent = (showRemaining ? '-' : '') + formatTime(shown);
  }

  function updateMarquee() {
    const track = player.currentTrack;
    const text = track ? track.name : 'Llama Amp — open a track to begin';
    marqueeText.textContent = text;
    marquee.classList.remove('scrolling');
    requestAnimationFrame(() => {
      const overflow = marqueeText.scrollWidth > marquee.clientWidth;
      if (overflow) {
        marqueeText.textContent = `${text}      ${text}`;
        const duration = Math.max(6, text.length * 0.22);
        marqueeText.style.animationDuration = `${duration}s`;
        marquee.classList.add('scrolling');
      }
    });
  }

  player.addEventListener('timeupdate', updateTime);
  player.addEventListener('trackchange', () => {
    seekBar.value = '0';
    updateMarquee();
  });
  player.addEventListener('playlist', updateMarquee);

  updateTime();
  updateMarquee();
}
