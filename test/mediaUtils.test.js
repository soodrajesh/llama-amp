import { describe, it, expect } from 'vitest';
import { isAllowedAudioPath, audioPathsFromArgv, parseRange } from '../src/main/mediaUtils.js';

describe('isAllowedAudioPath', () => {
  it('accepts every supported extension', () => {
    for (const ext of ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'flac', 'opus', 'weba']) {
      expect(isAllowedAudioPath(`/music/track.${ext}`)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isAllowedAudioPath('/music/track.MP3')).toBe(true);
  });

  it('rejects unsupported extensions', () => {
    expect(isAllowedAudioPath('/music/track.txt')).toBe(false);
    expect(isAllowedAudioPath('/music/track.aac')).toBe(false);
    expect(isAllowedAudioPath('/music/noext')).toBe(false);
  });
});

describe('audioPathsFromArgv', () => {
  it('keeps only audio-extensioned entries and resolves them', () => {
    const result = audioPathsFromArgv(['electron', '.', '/tmp/song.mp3', '--flag']);
    expect(result).toEqual(['/tmp/song.mp3']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(audioPathsFromArgv(['electron', '.'])).toEqual([]);
  });
});

describe('parseRange', () => {
  const SIZE = 1000;

  it('returns null for no Range header (full response)', () => {
    expect(parseRange(null, SIZE)).toBeNull();
    expect(parseRange('', SIZE)).toBeNull();
  });

  it('parses a bounded range', () => {
    expect(parseRange('bytes=0-99', SIZE)).toEqual({ start: 0, end: 99 });
  });

  it('parses an open-ended range (from start to EOF)', () => {
    expect(parseRange('bytes=900-', SIZE)).toEqual({ start: 900, end: 999 });
  });

  it('parses a suffix range (last N bytes)', () => {
    expect(parseRange('bytes=-500', SIZE)).toEqual({ start: 500, end: 999 });
  });

  it('clamps an end beyond the file size', () => {
    expect(parseRange('bytes=0-99999', SIZE)).toEqual({ start: 0, end: 999 });
  });

  it('rejects a malformed header', () => {
    expect(parseRange('not-a-range', SIZE)).toBe('unsatisfiable');
  });

  it('rejects start beyond the file size', () => {
    expect(parseRange('bytes=1000-1001', SIZE)).toBe('unsatisfiable');
  });

  it('rejects start after end', () => {
    expect(parseRange('bytes=500-100', SIZE)).toBe('unsatisfiable');
  });

  it('rejects an empty suffix ("bytes=-")', () => {
    expect(parseRange('bytes=-', SIZE)).toBe('unsatisfiable');
  });
});
