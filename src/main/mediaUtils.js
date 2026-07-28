import path from 'node:path';

export const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.oga', '.flac', '.opus', '.weba']);

export function isAllowedAudioPath(filePath) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Command-line args (Windows/Linux launch-with-file, or a relaunch forwarded via second-instance). */
export function audioPathsFromArgv(argv) {
  return argv.filter(isAllowedAudioPath).map((p) => path.resolve(p));
}

/**
 * net.fetch(file://...) correctly slices the body for a Range request but
 * never reports it - it comes back as a bare 200 with no Content-Length or
 * Content-Range, so <audio> has no way to tell the resource is seekable at
 * all and treats everything past what it has already buffered as
 * unseekable. Range has to be parsed and the response metadata constructed
 * by hand instead of trusting the passthrough.
 */
export function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return 'unsatisfiable';
  const [, startStr, endStr] = match;
  let start;
  let end;
  if (startStr === '') {
    if (endStr === '') return 'unsatisfiable';
    start = Math.max(0, size - Number(endStr));
    end = size - 1;
  } else {
    start = Number(startStr);
    end = endStr === '' ? size - 1 : Math.min(Number(endStr), size - 1);
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start < 0 || start >= size) {
    return 'unsatisfiable';
  }
  return { start, end };
}
