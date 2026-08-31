import type { DiscrepancyThreshold } from "./types.js";

export const discrepancyThreshold: DiscrepancyThreshold = {
  absoluteLiters: 100,
  percentage: 0.01,
  operator: "AND"
};

export interface DiscrepancyResult {
  varianceLiters: number;
  variancePercentage: number;
  absoluteVarianceLiters: number;
  absoluteVariancePercentage: number;
  isDiscrepancy: boolean;
  threshold: DiscrepancyThreshold;
}

export function evaluateDiscrepancy(
  pickupQuantityLiters: number,
  receivedQuantityLiters: number
): DiscrepancyResult {
  if (!Number.isFinite(pickupQuantityLiters) || pickupQuantityLiters <= 0) {
    throw new Error("Pickup quantity must be a positive finite number");
  }
  if (!Number.isFinite(receivedQuantityLiters) || receivedQuantityLiters < 0) {
    throw new Error("Received quantity must be a non-negative finite number");
  }

  const varianceLiters = receivedQuantityLiters - pickupQuantityLiters;
  const variancePercentage = varianceLiters / pickupQuantityLiters;
  const absoluteVarianceLiters = Math.abs(varianceLiters);
  const absoluteVariancePercentage = Math.abs(variancePercentage);

  return {
    varianceLiters,
    variancePercentage,
    absoluteVarianceLiters,
    absoluteVariancePercentage,
    isDiscrepancy:
      absoluteVarianceLiters > discrepancyThreshold.absoluteLiters &&
      absoluteVariancePercentage > discrepancyThreshold.percentage,
    threshold: discrepancyThreshold
  };
}
