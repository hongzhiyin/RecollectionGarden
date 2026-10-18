import { describe, expect, it } from 'vitest';
import { splitRatio } from '../../src/pdf/useReaderSplit';

describe('reader split constraints', () => {
  it('preserves the approved default and clamps both panels to real minimum widths', () => {
    expect(splitRatio(65, 1024)).toBe(65);
    expect((1024 - 8) * splitRatio(0, 1024) / 100).toBeCloseTo(420);
    expect((1024 - 8) * (100 - splitRatio(100, 1024)) / 100).toBeCloseTo(300);
  });
  it('retains the preference in stacked layout and recovers invalid preferences', () => {
    expect(splitRatio(67, 320)).toBe(67);
    expect(splitRatio(NaN, 1024)).toBe(65);
  });
});
