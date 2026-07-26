import { AudioEngine } from './audio/audioEngine.js';

function basename(filePath) {
  return filePath.split(/[\\/]/).pop();
}

/**
 * Central playback + playlist state. UI modules subscribe via `player.on(event, cb)`
 * and call methods to mutate state; player emits events so multiple UI modules
 * (transport, playlist, seekbar) stay in sync without knowing about each other.
 */
export class Player extends EventTarget {
  constructor() {
    super();
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.engine = new AudioEngine(this.audioEl);

    this.tracks = []; // { path, name }
    this.currentIndex = -1;
    this.isPlaying = false;

    this.audioEl.addEventListener('timeupdate', () => this.emit('timeupdate'));
    this.audioEl.addEventListener('loadedmetadata', () => this.emit('metadata'));
    this.audioEl.addEventListener('ended', () => this.next());
    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      this.emit('playstate');
    });
    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      this.emit('playstate');
    });
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  get currentTrack() {
    return this.tracks[this.currentIndex] ?? null;
  }

  async addPaths(paths) {
    const valid = await window.api.validatePaths(paths);
    const added = valid.map((path) => ({ path, name: basename(path) }));
    this.tracks.push(...added);
    this.emit('playlist');
    return added.length;
  }

  removeAt(index) {
    const wasCurrent = index === this.currentIndex;
    this.tracks.splice(index, 1);
    if (index < this.currentIndex) {
      this.currentIndex -= 1;
    } else if (wasCurrent) {
      this.stop();
      this.currentIndex = -1;
    }
    this.emit('playlist');
  }

  reorder(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [moved] = this.tracks.splice(fromIndex, 1);
    this.tracks.splice(toIndex, 0, moved);
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex -= 1;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex += 1;
    }
    this.emit('playlist');
  }

  clear() {
    this.stop();
    this.tracks = [];
    this.currentIndex = -1;
    this.emit('playlist');
  }

  async playIndex(index) {
    if (index < 0 || index >= this.tracks.length) return;
    await this.engine.resume();
    this.currentIndex = index;
    await this.engine.loadTrack(this.tracks[index].path);
    this.emit('trackchange');
    try {
      await this.audioEl.play();
    } catch {
      // Autoplay/decoding failure - state stays paused, UI reflects via playstate event.
    }
  }

  async togglePlayPause() {
    if (this.currentIndex === -1) {
      if (this.tracks.length > 0) await this.playIndex(0);
      return;
    }
    if (this.audioEl.paused) {
      await this.engine.resume();
      await this.audioEl.play();
    } else {
      this.audioEl.pause();
    }
  }

  pause() {
    this.audioEl.pause();
  }

  stop() {
    this.audioEl.pause();
    this.audioEl.currentTime = 0;
    this.emit('timeupdate');
  }

  next() {
    if (this.tracks.length === 0) return;
    const nextIndex = (this.currentIndex + 1) % this.tracks.length;
    this.playIndex(nextIndex);
  }

  prev() {
    if (this.tracks.length === 0) return;
    const prevIndex = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playIndex(prevIndex);
  }

  seekToRatio(ratio) {
    if (!Number.isFinite(this.audioEl.duration)) return;
    this.audioEl.currentTime = ratio * this.audioEl.duration;
  }

  setVolume01(v) {
    this.engine.setVolume(v);
  }

  setBalance(v) {
    this.engine.setBalance(v);
  }

  async savePlaylist() {
    return window.api.savePlaylist(this.tracks);
  }

  async loadPlaylist() {
    const tracks = await window.api.loadPlaylist();
    if (!tracks) return false;
    this.stop();
    this.tracks = tracks;
    this.currentIndex = -1;
    this.emit('playlist');
    return true;
  }
}
