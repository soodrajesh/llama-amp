import { describe, it, expect } from 'vitest';
import { boundsAreOnScreen } from '../src/main/windowState.js';

const DISPLAY = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };

describe('boundsAreOnScreen', () => {
  it('accepts a window fully within a display', () => {
    expect(boundsAreOnScreen({ x: 100, y: 100, width: 275, height: 480 }, [DISPLAY])).toBe(true);
  });

  it('accepts a window merely overlapping a display', () => {
    expect(boundsAreOnScreen({ x: -50, y: -50, width: 275, height: 480 }, [DISPLAY])).toBe(true);
  });

  it('rejects a window entirely off every display (e.g. an unplugged monitor)', () => {
    expect(boundsAreOnScreen({ x: 5000, y: 5000, width: 275, height: 480 }, [DISPLAY])).toBe(false);
  });

  it('checks against every display, not just the first', () => {
    const second = { workArea: { x: 1920, y: 0, width: 1920, height: 1080 } };
    expect(boundsAreOnScreen({ x: 2000, y: 100, width: 275, height: 480 }, [DISPLAY, second])).toBe(true);
  });
});
