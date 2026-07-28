export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
export const EQ_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
export const EQ_GAIN_RANGE_DB = 12;
export const EQ_SLIDER_STEPS = 100; // slider resolution per band, mapped to +-EQ_GAIN_RANGE_DB

export function dbToSliderValue(db) {
  return Math.round(((db + EQ_GAIN_RANGE_DB) / (2 * EQ_GAIN_RANGE_DB)) * EQ_SLIDER_STEPS);
}

export function sliderValueToDb(value) {
  return (value / EQ_SLIDER_STEPS) * (2 * EQ_GAIN_RANGE_DB) - EQ_GAIN_RANGE_DB;
}

// Each preset is { preamp, bands: number[10] } in dB, within ±EQ_GAIN_RANGE_DB.
export const EQ_PRESETS = {
  Flat: { preamp: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  Rock: { preamp: 2, bands: [6, 4, -2, -4, -2, 2, 5, 7, 7, 7] },
  Pop: { preamp: 1, bands: [-1, 3, 5, 5, 3, -1, -2, -2, -1, -1] },
  Classical: { preamp: 0, bands: [4, 3, 2, 0, 0, 0, -3, -3, -3, -5] },
  BassBoost: { preamp: 3, bands: [9, 8, 6, 3, 0, 0, 0, 0, 0, 0] },
  TrebleBoost: { preamp: 1, bands: [0, 0, 0, 0, 0, 2, 5, 7, 8, 9] },
  Live: { preamp: 0, bands: [-2, 0, 2, 3, 3, 3, 2, 1, 1, 0] },
};
