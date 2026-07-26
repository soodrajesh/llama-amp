const MODES = ['bars', 'scope', 'off'];

export function initVisualizer(player) {
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  let modeIndex = 0;
  let freqData = null;
  let timeData = null;

  function resizeCanvas() {
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('click', () => {
    modeIndex = (modeIndex + 1) % MODES.length;
  });

  function clear() {
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawBars(analyser) {
    if (!freqData) freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);

    const barCount = 28;
    const step = Math.floor(freqData.length / barCount);
    const gap = 2 * dpr;
    const barWidth = canvas.width / barCount - gap;

    for (let i = 0; i < barCount; i++) {
      const value = freqData[i * step] / 255;
      const barHeight = Math.max(2 * dpr, value * canvas.height);
      const x = i * (barWidth + gap);
      const y = canvas.height - barHeight;

      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#3fd05a');
      gradient.addColorStop(0.7, '#a8f56a');
      gradient.addColorStop(1, '#ffe45c');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Peak cap for the classic LED look.
      ctx.fillStyle = '#eafff0';
      ctx.fillRect(x, Math.max(0, y - 2 * dpr), barWidth, 1.5 * dpr);
    }
  }

  function drawScope(analyser) {
    if (!timeData) timeData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeData);

    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = '#7cf58a';
    ctx.shadowColor = 'rgba(124, 245, 138, 0.6)';
    ctx.shadowBlur = 4 * dpr;
    ctx.beginPath();

    const sliceWidth = canvas.width / timeData.length;
    let x = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] / 128 - 1;
      const y = canvas.height / 2 + v * (canvas.height / 2) * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawIdle() {
    ctx.strokeStyle = 'rgba(124, 245, 138, 0.4)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  function tick() {
    clear();
    const analyser = player.engine.analyser;
    const mode = MODES[modeIndex];

    if (!analyser || !player.isPlaying || mode === 'off') {
      drawIdle();
    } else if (mode === 'bars') {
      drawBars(analyser);
    } else {
      drawScope(analyser);
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
