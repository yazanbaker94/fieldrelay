import { describe, expect, it } from 'vitest';
import {
  calculateDiscrepancy,
  formatSignedLitres,
  formatSignedPercent,
} from './discrepancy';

describe('calculateDiscrepancy', () => {
  it('opens the FieldRelay demo exception only when both thresholds are exceeded', () => {
    const result = calculateDiscrepancy(8_180, 7_940);

    expect(result.differenceLitres).toBe(-240);
    expect(result.differencePercent).toBeCloseTo(-0.02933985, 6);
    expect(result.exceedsLitres).toBe(true);
    expect(result.exceedsPercent).toBe(true);
    expect(result.opensException).toBe(true);
    expect(formatSignedLitres(result.differenceLitres)).toBe('−240 L');
    expect(formatSignedPercent(result.differencePercent)).toBe('−2.93%');
  });

  it('does not open an exception when only the litre threshold is exceeded', () => {
    const result = calculateDiscrepancy(50_000, 49_880);
    expect(result.exceedsLitres).toBe(true);
    expect(result.exceedsPercent).toBe(false);
    expect(result.opensException).toBe(false);
  });
});

