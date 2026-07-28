import { EQ_LABELS, EQ_PRESETS, EQ_SLIDER_STEPS, dbToSliderValue, sliderValueToDb } from '../audio/eqBands.js';

const CUSTOM_PRESET_KEY = 'llamaamp:customPreset';

export function initEqualizerPanel(player) {
  const slidersContainer = document.getElementById('eq-sliders');
  const onBtn = document.getElementById('eq-on-btn');
  const presetSelect = document.getElementById('eq-preset');
  const saveBtn = document.getElementById('eq-save-preset');

  const bandInputs = [];
  let preampInput;

  function makeBand({ label, isPreamp, index }) {
    const wrap = document.createElement('div');
    wrap.className = 'eq-band' + (isPreamp ? ' preamp-band' : '');

    const valueEl = document.createElement('div');
    valueEl.className = 'eq-gain-value';
    valueEl.textContent = '0';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(EQ_SLIDER_STEPS);
    input.value = String(dbToSliderValue(0));
    input.setAttribute('aria-label', isPreamp ? 'Preamp gain' : `${label} Hz band gain`);

    const labelEl = document.createElement('div');
    labelEl.className = 'eq-band-label';
    labelEl.textContent = label;

    input.addEventListener('input', () => {
      const db = sliderValueToDb(Number(input.value));
      valueEl.textContent = db > 0 ? `+${db.toFixed(0)}` : db.toFixed(0);
      if (isPreamp) {
        player.engine.setPreampDb(db);
      } else {
        player.engine.setBandDb(index, db);
      }
      presetSelect.value = 'Custom';
    });

    wrap.append(valueEl, input, labelEl);
    return { wrap, input, valueEl };
  }

  const preampBand = makeBand({ label: 'PRE', isPreamp: true });
  preampInput = preampBand.input;
  slidersContainer.appendChild(preampBand.wrap);

  EQ_LABELS.forEach((label, index) => {
    const band = makeBand({ label, isPreamp: false, index });
    bandInputs.push(band);
    slidersContainer.appendChild(band.wrap);
  });

  function applyPresetToSliders(preset) {
    preampInput.value = String(dbToSliderValue(preset.preamp));
    preampBand.valueEl.textContent = preset.preamp > 0 ? `+${preset.preamp}` : String(preset.preamp);
    player.engine.setPreampDb(preset.preamp);
    preset.bands.forEach((db, i) => {
      bandInputs[i].input.value = String(dbToSliderValue(db));
      bandInputs[i].valueEl.textContent = db > 0 ? `+${db}` : String(db);
      player.engine.setBandDb(i, db);
    });
  }

  function loadCustomPreset() {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const allPresetNames = Object.keys(EQ_PRESETS);
  for (const name of allPresetNames) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    presetSelect.appendChild(opt);
  }
  const customOpt = document.createElement('option');
  customOpt.value = 'Custom';
  customOpt.textContent = 'Custom';
  presetSelect.appendChild(customOpt);
  presetSelect.value = 'Flat';

  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === 'Custom') {
      const custom = loadCustomPreset();
      if (custom) applyPresetToSliders(custom);
      return;
    }
    applyPresetToSliders(EQ_PRESETS[presetSelect.value]);
  });

  saveBtn.addEventListener('click', () => {
    const preset = {
      preamp: sliderValueToDb(Number(preampInput.value)),
      bands: bandInputs.map((b) => sliderValueToDb(Number(b.input.value))),
    };
    localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(preset));
    presetSelect.value = 'Custom';
  });

  let eqOn = true;
  onBtn.classList.add('active');
  onBtn.addEventListener('click', () => {
    eqOn = !eqOn;
    player.engine.setEqEnabled(eqOn);
    onBtn.classList.toggle('active', eqOn);
    onBtn.textContent = eqOn ? 'ON' : 'OFF';
  });
}
