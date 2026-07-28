import { describe, it, expect } from 'vitest';
import { formatTime } from '../src/renderer/js/util/format.js';

describe('formatTime', () => {
  it('pads minutes and seconds to two digits', () => {
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65)).toBe('01:05');
  });

  it('floors fractional seconds', () => {
    expect(formatTime(59.9)).toBe('00:59');
  });

  it('handles values an hour or more as minutes:seconds, not clamped', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('falls back to 00:00 for non-finite or negative input', () => {
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTime(Infinity)).toBe('00:00');
    expect(formatTime(-5)).toBe('00:00');
  });
});
