export const EQ_BANDS = [
  32, 45, 64, 95, 140, 200, 290, 415, 600, 860, 1200, 1800, 2600, 3700, 5300, 7700,
  11000, 16000
];

export const EQ_BAND_COUNT = EQ_BANDS.length;
export const EQ_Q = 1.4;
export const EQ_MIN = -12;
export const EQ_MAX = 12;

export const EQ_PREAMP_MIN = -24;
export const EQ_PREAMP_MAX = 6;
export const EQ_PREAMP_DEFAULT = 0;

export const EQ_INTENSITY_MIN = 0;
export const EQ_INTENSITY_MAX = 1;
export const EQ_INTENSITY_DEFAULT = 1;

export const EQ_FLAT: number[] = EQ_BANDS.map(() => 0);

export const EQ_PRESETS: Record<string, number[]> = {
  'Bass boost': [7, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Treble boost': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7],
  'Vocal boost': [-3, -3, -2, -1, 0, 1, 2, 4, 5, 5, 5, 4, 3, 2, 1, 0, -1, -2],
  House: [6, 6, 5, 3, 1, 0, -1, -2, -2, -1, 0, 1, 2, 3, 4, 4, 3, 2],
  Rock: [5, 5, 4, 2, 1, 0, -1, -1, 0, 1, 2, 2, 3, 3, 3, 2, 2, 1],
  'Spoken Word': [-5, -4, -3, -1, 1, 3, 4, 4, 4, 4, 3, 3, 2, 1, 0, -2, -3, -4],
  'Small Speakers': [-6, -5, -3, 0, 2, 3, 3, 2, 1, 1, 1, 2, 2, 2, 1, 0, -2, -4],
  TV: [3, 3, 2, 1, 2, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 0, 0],
  Car: [7, 7, 6, 4, 2, 0, -1, -1, 0, 1, 2, 3, 4, 4, 5, 5, 5, 4],
  Quietness: [8, 7, 6, 4, 2, 1, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7],
  Loudness: [6, 6, 5, 4, 2, 1, 0, 0, 1, 1, 2, 2, 3, 4, 4, 5, 6, 6]
};
