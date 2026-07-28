/** Winamp's signature move: double-click the titlebar to collapse to just the transport row. */
export function initShadeMode() {
  const titlebar = document.querySelector('.titlebar');
  const chassis = document.getElementById('app');
  let shaded = false;

  titlebar.addEventListener('dblclick', (e) => {
    if (e.target.closest('.chrome-btn') || e.target.closest('.llama-icon')) return;
    shaded = !shaded;
    chassis.classList.toggle('shade', shaded);
    window.api.setShadeMode(shaded);
  });
}
