import { describe, expect, it } from "vitest";
import { evaluateDiscrepancy } from "../src/domain/discrepancy.js";

describe("discrepancy rule", () => {
  it("opens the demo discrepancy because both thresholds are exceeded", () => {
    const result = evaluateDiscrepancy(8180, 7940);
    expect(result.varianceLiters).toBe(-240);
    expect(result.variancePercentage).toBeCloseTo(-0.0293398533, 8);
    expect(result.isDiscrepancy).toBe(true);
    expect(result.threshold.operator).toBe("AND");
  });

  it("does not open when only the absolute threshold is exceeded", () => {
    // 101 L is over 100 L, but only 0.505% of a 20,000 L pickup.
    expect(evaluateDiscrepancy(20_000, 19_899).isDiscrepancy).toBe(false);
  });

  it("does not open when only the percentage threshold is exceeded", () => {
    // 2% is over 1%, but 20 L is not over 100 L.
    expect(evaluateDiscrepancy(1_000, 980).isDiscrepancy).toBe(false);
  });

  it("uses strict greater-than boundaries", () => {
    expect(evaluateDiscrepancy(10_000, 9_900).isDiscrepancy).toBe(false);
  });
});
