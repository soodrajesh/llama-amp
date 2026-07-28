import { AudioEngine } from './audio/audioEngine.js';
import { computeShuffleOrder } from './audio/shuffle.js';

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
    // Tracks load from the llama-media: custom protocol, which is cross-origin
    // relative to the page. Without this, createMediaElementSource() below
    // still reports normal playback (currentTime advances) but silently
    // zeroes every sample reaching the Web Audio graph - no error, no sound.
    this.audioEl.crossOrigin = 'anonymous';
    this.engine = new AudioEngine(this.audioEl);

    this.tracks = []; // { path, name }
    this.currentIndex = -1;
    this.isPlaying = false;

    // Shuffle plays a pre-computed permutation rather than picking at random each
    // time, so every track is heard once before any repeats.
    this.shuffle = false;
    this.shuffleOrder = [];
    this.shufflePos = -1;

    this.audioEl.addEventListener('timeupdate', () => this.emit('timeupdate'));
    this.audioEl.addEventListener('loadedmetadata', () => this.emit('metadata'));
    this.audioEl.addEventListener('ended', () => this.handleTrackEnd());
    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      this.emit('playstate');
    });
    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      this.emit('playstate');
    });
    // A mid-playback network/decode failure (as opposed to a failed start,
    // handled in playIndex) otherwise leaves the element stalled with no
    // signal: isPlaying stays true and currentTime just stops advancing.
    this.audioEl.addEventListener('error', () => {
      const track = this.currentTrack;
      this.stop();
      this.emit('playerror', { track, message: `Playback error on ${track?.name ?? 'track'}` });
    });
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  get currentTrack() {
    return this.tracks[this.currentIndex] ?? null;
  }

  setShuffle(enabled) {
    this.shuffle = enabled;
    if (enabled) this.rebuildShuffleOrder();
    this.emit('shuffle');
  }

  rebuildShuffleOrder() {
    this.shuffleOrder = computeShuffleOrder(this.tracks.length, this.currentIndex);
    this.shufflePos = this.currentIndex === -1 ? -1 : 0;
  }

  /** Track indices move on any playlist mutation, so the permutation is rebuilt. */
  syncShuffle() {
    if (this.shuffle) this.rebuildShuffleOrder();
  }

  async addPaths(paths) {
    const valid = await window.api.validatePaths(paths);
    const added = valid.map((path) => ({ path, name: basename(path) }));
    this.tracks.push(...added);
    this.syncShuffle();
    this.emit('playlist');
    if (added.length > 0) this.enrichMetadata(added);
    return added.length;
  }

  /** Add paths and, if nothing is currently playing, start at the first newly-added track. */
  async openPaths(paths) {
    const startIndex = this.tracks.length;
    const added = await this.addPaths(paths);
    if (added > 0 && this.currentIndex === -1) {
      await this.start(startIndex);
    }
    return added;
  }

  /**
   * Fire-and-forget ID3 lookup for newly-added tracks: fills in a proper
   * "Artist - Title" display name and artwork when available, without making
   * addPaths() wait on tag parsing for every file in a large folder add.
   */
  async enrichMetadata(tracks) {
    const results = await Promise.allSettled(
      tracks.map(async (track) => ({ track, meta: await window.api.metadataFor(track.path) }))
    );
    let playlistChanged = false;
    let currentTrackChanged = false;
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.meta) continue;
      const { track, meta } = result.value;
      if (meta.title) {
        track.name = meta.artist ? `${meta.artist} - ${meta.title}` : meta.title;
        playlistChanged = true;
        if (track === this.currentTrack) currentTrackChanged = true;
      }
      if (meta.artist) track.artist = meta.artist;
      if (meta.album) track.album = meta.album;
      if (meta.artwork) track.artwork = meta.artwork;
    }
    if (playlistChanged) this.emit('playlist');
    if (currentTrackChanged) this.emit('trackchange');
  }

  /** Informational (non-error) message for the marquee, e.g. restored/loaded-with-gaps notices. */
  notify(message) {
    this.emit('notice', { message });
  }

  /** Used by session restore to repopulate the playlist without touching playback state. */
  restoreTracks(tracks) {
    this.tracks = tracks;
    this.syncShuffle();
    this.emit('playlist');
    if (tracks.length > 0) this.enrichMetadata(tracks);
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
    this.syncShuffle();
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
    this.syncShuffle();
    this.emit('playlist');
  }

  clear() {
    this.stop();
    this.tracks = [];
    this.currentIndex = -1;
    this.syncShuffle();
    this.emit('playlist');
  }

  /**
   * Never rejects: a missing/undecodable file surfaces as a 'playerror' event so
   * callers (including the `ended` auto-advance) can stay fire-and-forget.
   */
  async playIndex(index) {
    if (index < 0 || index >= this.tracks.length) return;
    const track = this.tracks[index];
    this.currentIndex = index;
    // Keep the shuffle cursor aligned when a track is chosen directly.
    if (this.shuffle) {
      const pos = this.shuffleOrder.indexOf(index);
      if (pos !== -1) this.shufflePos = pos;
    }
    this.emit('trackchange');
    try {
      await this.engine.resume();
      await this.engine.loadTrack(track.path);
      await this.audioEl.play();
    } catch {
      // Most likely the file moved or was deleted since it was added.
      this.emit('playerror', { track, message: `Can't play ${track.name}` });
    }
  }

  /** Auto-advance stops at the end of the playlist; manual next/prev still wrap. */
  handleTrackEnd() {
    if (this.shuffle) {
      if (this.shufflePos + 1 >= this.shuffleOrder.length) {
        this.stop();
        return;
      }
      this.shufflePos += 1;
      this.playIndex(this.shuffleOrder[this.shufflePos]);
      return;
    }
    if (this.currentIndex >= this.tracks.length - 1) {
      this.stop();
      return;
    }
    this.playIndex(this.currentIndex + 1);
  }

  /**
   * Begin playback from a stopped state. Honours shuffle, so pressing play with
   * shuffle on starts somewhere random instead of always at the first track.
   */
  async start(preferredIndex = 0) {
    if (this.tracks.length === 0) return;
    if (this.shuffle) {
      if (this.shuffleOrder.length !== this.tracks.length) this.rebuildShuffleOrder();
      this.shufflePos = 0;
      await this.playIndex(this.shuffleOrder[0]);
      return;
    }
    await this.playIndex(preferredIndex);
  }

  async togglePlayPause() {
    if (this.currentIndex === -1) {
      await this.start();
      return;
    }
    if (this.audioEl.paused) {
      try {
        await this.engine.resume();
        await this.audioEl.play();
      } catch {
        this.emit('playerror', {
          track: this.currentTrack,
          message: `Can't play ${this.currentTrack?.name ?? 'track'}`,
        });
      }
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
    if (this.shuffle) {
      // Reaching the end of the permutation reshuffles for another pass.
      if (this.shufflePos + 1 >= this.shuffleOrder.length) {
        this.rebuildShuffleOrder();
        this.shufflePos = -1;
      }
      this.shufflePos += 1;
      this.playIndex(this.shuffleOrder[this.shufflePos]);
      return;
    }
    const nextIndex = (this.currentIndex + 1) % this.tracks.length;
    this.playIndex(nextIndex);
  }

  prev() {
    if (this.tracks.length === 0) return;
    if (this.shuffle) {
      // Step back through what was already played rather than picking randomly.
      if (this.shufflePos <= 0) return;
      this.shufflePos -= 1;
      this.playIndex(this.shuffleOrder[this.shufflePos]);
      return;
    }
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
    // Artwork/artist/album are ID3-derived and cheap to re-fetch; keeping them
    // out of the saved file is what keeps playlist files small and portable.
    const minimal = this.tracks.map((t) => ({ path: t.path, name: t.name }));
    return window.api.savePlaylist(minimal);
  }

  async loadPlaylist() {
    const result = await window.api.loadPlaylist();
    if (!result) return false;
    this.stop();
    this.tracks = result.tracks;
    this.currentIndex = -1;
    this.syncShuffle();
    this.emit('playlist');
    if (result.skipped > 0) {
      this.notify(`Loaded ${result.tracks.length} track(s), ${result.skipped} missing`);
    }
    if (result.tracks.length > 0) this.enrichMetadata(result.tracks);
    return true;
  }
}
