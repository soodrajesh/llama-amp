/** Feeds the OS "Now Playing" surface (macOS Control Center, lock screen, hardware/Bluetooth media keys). */
export function initMediaSession(player) {
  if (!('mediaSession' in navigator)) return;

  function updateMetadata() {
    const track = player.currentTrack;
    navigator.mediaSession.metadata = track
      ? new MediaMetadata({
          title: track.name,
          artist: track.artist || '',
          album: track.album || '',
          artwork: track.artwork ? [{ src: track.artwork }] : [],
        })
      : null;
  }

  navigator.mediaSession.setActionHandler('play', () => player.togglePlayPause());
  navigator.mediaSession.setActionHandler('pause', () => player.pause());
  navigator.mediaSession.setActionHandler('stop', () => player.stop());
  navigator.mediaSession.setActionHandler('previoustrack', () => player.prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => player.next());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (Number.isFinite(details.seekTime) && Number.isFinite(player.audioEl.duration)) {
      player.audioEl.currentTime = details.seekTime;
    }
  });

  player.addEventListener('trackchange', updateMetadata);
  player.addEventListener('playlist', updateMetadata); // ID3 tags can resolve after trackchange already fired
  player.addEventListener('playstate', () => {
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused';
  });
}
