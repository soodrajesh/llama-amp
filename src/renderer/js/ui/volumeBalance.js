export function initVolumeBalance(player) {
  const volumeSlider = document.getElementById('volume-slider');
  const balanceSlider = document.getElementById('balance-slider');

  const applyVolume = () => player.setVolume01(Number(volumeSlider.value) / 100);
  const applyBalance = () => player.setBalance(Number(balanceSlider.value) / 100);

  volumeSlider.addEventListener('input', applyVolume);
  balanceSlider.addEventListener('input', applyBalance);

  applyVolume();
  applyBalance();
}
