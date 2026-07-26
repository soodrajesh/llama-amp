import { EQ_FREQUENCIES } from './eqBands.js';

/**
 * Wraps a single <audio> element with a Web Audio graph:
 * audio -> preamp -> [10x peaking biquad] -> panner (balance) -> masterGain -> destination
 * The element/graph is created once (on first user-gesture play) and reused across
 * tracks by swapping audio.src. All setters work before the graph exists — values
 * are cached and applied once ensureGraph() runs.
 */
export class AudioEngine {
  constructor(audioElement) {
    this.audioElement = audioElement;
    this.audioCtx = null;
    this.sourceNode = null;
    this.preampGain = null;
    this.filters = [];
    this.panner = null;
    this.masterGain = null;
    this.analyser = null;
    this.eqEnabled = true;
    this.storedGains = new Array(EQ_FREQUENCIES.length).fill(0);
    this.storedPreamp = 0;
    this.storedVolume = 0.8;
    this.storedBalance = 0;
  }

  /** Must be called from a user-gesture handler (e.g. the Play button). */
  ensureGraph() {
    if (this.audioCtx) return;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextCtor();

    this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);
    this.preampGain = this.audioCtx.createGain();
    this.panner = this.audioCtx.createStereoPanner();
    this.masterGain = this.audioCtx.createGain();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.75;

    this.filters = EQ_FREQUENCIES.map((freq) => {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1;
      filter.gain.value = 0;
      return filter;
    });

    let node = this.sourceNode;
    node.connect(this.preampGain);
    node = this.preampGain;
    for (const filter of this.filters) {
      node.connect(filter);
      node = filter;
    }
    node.connect(this.panner);
    this.panner.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);

    // Re-apply any values set before the graph existed.
    this.setEqEnabled(this.eqEnabled);
    this.panner.pan.value = this.storedBalance;
    this.masterGain.gain.value = this.storedVolume;
  }

  async resume() {
    this.ensureGraph();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  async loadTrack(filePath) {
    const url = await window.api.mediaUrlFor(filePath);
    if (!url) throw new Error(`Rejected: not a playable audio file path (${filePath})`);
    this.audioElement.src = url;
  }

  setPreampDb(db) {
    this.storedPreamp = db;
    if (!this.eqEnabled) return;
    if (this.preampGain) this.preampGain.gain.value = dbToGain(db);
  }

  setBandDb(index, db) {
    this.storedGains[index] = db;
    if (!this.eqEnabled) return;
    const filter = this.filters[index];
    if (filter) filter.gain.value = db;
  }

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    if (enabled) {
      this.filters.forEach((filter, i) => {
        filter.gain.value = this.storedGains[i];
      });
      if (this.preampGain) this.preampGain.gain.value = dbToGain(this.storedPreamp);
    } else {
      this.filters.forEach((filter) => {
        filter.gain.value = 0;
      });
      if (this.preampGain) this.preampGain.gain.value = 1;
    }
  }

  setVolume(volume01) {
    this.storedVolume = Math.min(1, Math.max(0, volume01));
    if (this.masterGain) this.masterGain.gain.value = this.storedVolume;
  }

  setBalance(balanceNeg1To1) {
    this.storedBalance = balanceNeg1To1;
    if (this.panner) this.panner.pan.value = balanceNeg1To1;
  }

}

function dbToGain(db) {
  return 10 ** (db / 20);
}
