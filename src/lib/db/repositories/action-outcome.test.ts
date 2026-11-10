import { describe, expect, it } from "vitest";
import { settledPlanStatus } from "./action-outcome";

describe("multi-action receipt aggregation", () => {
  it("keeps the plan executing until every receipt settles", () => {
    expect(settledPlanStatus([])).toBeNull();
    expect(settledPlanStatus(["succeeded", "executing"])).toBeNull();
    expect(settledPlanStatus(["failed", "pending"])).toBeNull();
  });

  it("preserves partial failure and ambiguous outcomes", () => {
    expect(settledPlanStatus(["succeeded", "succeeded"])).toBe("succeeded");
    expect(settledPlanStatus(["succeeded", "failed"])).toBe("failed");
    expect(settledPlanStatus(["succeeded", "unknown"])).toBe("unknown");
  });
});
