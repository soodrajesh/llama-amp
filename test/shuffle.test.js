import { describe, it, expect } from 'vitest';
import { computeShuffleOrder } from '../src/renderer/js/audio/shuffle.js';

describe('computeShuffleOrder', () => {
  it('is a permutation of every track index', () => {
    const order = computeShuffleOrder(10, -1);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('places the currently-playing index first', () => {
    for (let i = 0; i < 20; i++) {
      const order = computeShuffleOrder(8, 5);
      expect(order[0]).toBe(5);
    }
  });

  it('handles an empty track list', () => {
    expect(computeShuffleOrder(0, -1)).toEqual([]);
  });

  it('handles a single track', () => {
    expect(computeShuffleOrder(1, 0)).toEqual([0]);
  });
});
