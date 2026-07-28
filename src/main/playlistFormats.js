import path from 'node:path';

/** Track shape throughout: { path: string, name: string }. */

export function serializeM3U(tracks) {
  const lines = ['#EXTM3U'];
  for (const track of tracks) {
    lines.push(`#EXTINF:-1,${track.name}`);
    lines.push(track.path);
  }
  return lines.join('\n') + '\n';
}

/**
 * M3U files are plain text with one path per non-comment line; paths are
 * conventionally relative to the playlist file itself, so a bare filename
 * still resolves for playlists shared alongside their tracks.
 */
export function parseM3U(text, baseDir) {
  const tracks = [];
  let pendingName = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line === '#EXTM3U') continue;
    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',');
      pendingName = comma === -1 ? null : line.slice(comma + 1).trim();
      continue;
    }
    if (line.startsWith('#')) continue;
    const resolved = path.isAbsolute(line) ? line : path.resolve(baseDir, line);
    tracks.push({ path: resolved, name: pendingName || path.basename(resolved) });
    pendingName = null;
  }
  return tracks;
}

export function serializeJSON(tracks) {
  return JSON.stringify(tracks, null, 2);
}

export function parseJSON(text) {
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [];
}
