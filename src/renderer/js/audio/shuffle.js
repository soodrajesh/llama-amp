/**
 * Fisher-Yates over the track indices. The currently playing track is moved to
 * the front so the permutation continues from where the listener already is
 * instead of possibly replaying it immediately.
 */
export function computeShuffleOrder(trackCount, currentIndex) {
  const indices = Array.from({ length: trackCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  if (currentIndex !== -1) {
    const pos = indices.indexOf(currentIndex);
    if (pos > 0) {
      indices.splice(pos, 1);
      indices.unshift(currentIndex);
    }
  }
  return indices;
}
