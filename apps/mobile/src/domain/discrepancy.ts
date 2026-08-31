export const DISCREPANCY_LITRE_THRESHOLD = 100;
export const DISCREPANCY_PERCENT_THRESHOLD = 0.01;

export interface DiscrepancyResult {
  differenceLitres: number;
  differencePercent: number;
  exceedsLitres: boolean;
  exceedsPercent: boolean;
  opensException: boolean;
}

export function calculateDiscrepancy(
  pickupQuantityLitres: number,
  receivedQuantityLitres: number,
): DiscrepancyResult {
  const differenceLitres = receivedQuantityLitres - pickupQuantityLitres;
  const differencePercent =
    pickupQuantityLitres === 0 ? 0 : differenceLitres / pickupQuantityLitres;
  const exceedsLitres = Math.abs(differenceLitres) > DISCREPANCY_LITRE_THRESHOLD;
  const exceedsPercent = Math.abs(differencePercent) > DISCREPANCY_PERCENT_THRESHOLD;

  return {
    differenceLitres,
    differencePercent,
    exceedsLitres,
    exceedsPercent,
    opensException: exceedsLitres && exceedsPercent,
  };
}

export function formatSignedLitres(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toLocaleString('en-CA')} L`;
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value * 100).toFixed(2)}%`;
}

