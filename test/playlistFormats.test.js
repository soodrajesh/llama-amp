import { describe, it, expect } from 'vitest';
import { serializeM3U, parseM3U, serializeJSON, parseJSON } from '../src/main/playlistFormats.js';

describe('M3U round-trip', () => {
  const tracks = [
    { path: '/music/a.mp3', name: 'Artist - Song A' },
    { path: '/music/sub/b.flac', name: 'Song B' },
  ];

  it('serializes with #EXTM3U header and #EXTINF per track', () => {
    const text = serializeM3U(tracks);
    expect(text.startsWith('#EXTM3U\n')).toBe(true);
    expect(text).toContain('#EXTINF:-1,Artist - Song A');
    expect(text).toContain('/music/a.mp3');
  });

  it('parses its own output back to the same paths/names', () => {
    const text = serializeM3U(tracks);
    const parsed = parseM3U(text, '/base');
    expect(parsed).toEqual(tracks);
  });

  it('resolves a relative path against the given base directory', () => {
    const text = '#EXTM3U\n#EXTINF:-1,Relative Track\nsongs/rel.mp3\n';
    const parsed = parseM3U(text, '/base/dir');
    expect(parsed).toEqual([{ path: '/base/dir/songs/rel.mp3', name: 'Relative Track' }]);
  });

  it('falls back to the filename when there is no #EXTINF line', () => {
    const text = '#EXTM3U\n/music/untitled.mp3\n';
    const parsed = parseM3U(text, '/base');
    expect(parsed).toEqual([{ path: '/music/untitled.mp3', name: 'untitled.mp3' }]);
  });

  it('ignores blank lines and unknown comment lines', () => {
    const text = '#EXTM3U\n\n#SOME-OTHER-TAG:x\n/music/a.mp3\n';
    const parsed = parseM3U(text, '/base');
    expect(parsed).toEqual([{ path: '/music/a.mp3', name: 'a.mp3' }]);
  });
});

describe('JSON format', () => {
  it('round-trips tracks', () => {
    const tracks = [{ path: '/music/a.mp3', name: 'a.mp3' }];
    expect(parseJSON(serializeJSON(tracks))).toEqual(tracks);
  });

  it('returns an empty array for non-array JSON', () => {
    expect(parseJSON('{"not":"an array"}')).toEqual([]);
  });
});
