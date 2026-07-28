import { describe, it, expect } from 'vitest';
import {
  EQ_FREQUENCIES,
  EQ_LABELS,
  EQ_PRESETS,
  EQ_GAIN_RANGE_DB,
  dbToSliderValue,
  sliderValueToDb,
} from '../src/renderer/js/audio/eqBands.js';

describe('EQ preset shape', () => {
  it('every preset has one gain per band', () => {
    for (const preset of Object.values(EQ_PRESETS)) {
      expect(preset.bands).toHaveLength(EQ_FREQUENCIES.length);
    }
  });

  it('labels line up 1:1 with frequencies', () => {
    expect(EQ_LABELS).toHaveLength(EQ_FREQUENCIES.length);
  });

  it('every preset band stays within the slider range', () => {
    for (const preset of Object.values(EQ_PRESETS)) {
      for (const db of [...preset.bands, preset.preamp]) {
        expect(Math.abs(db)).toBeLessThanOrEqual(EQ_GAIN_RANGE_DB);
      }
    }
  });
});

describe('slider <-> dB conversion', () => {
  it('round-trips through slider values', () => {
    for (const db of [-12, -6, 0, 6, 12]) {
      expect(sliderValueToDb(dbToSliderValue(db))).toBeCloseTo(db, 5);
    }
  });

  it('maps 0dB to the slider midpoint', () => {
    expect(dbToSliderValue(0)).toBe(50);
  });

  it('maps the extremes to the slider bounds', () => {
    expect(dbToSliderValue(-EQ_GAIN_RANGE_DB)).toBe(0);
    expect(dbToSliderValue(EQ_GAIN_RANGE_DB)).toBe(100);
  });
});
