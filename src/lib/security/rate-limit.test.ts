import { describe, expect, it } from "vitest";
import { rateWindowStart } from "./rate-limit";

describe("provider request windows", () => {
  it("rounds to fixed UTC ten-minute buckets", () => {
    expect(rateWindowStart(new Date("2026-11-09T16:23:59Z")).toISOString()).toBe("2026-11-09T16:20:00.000Z");
    expect(rateWindowStart(new Date("2026-11-09T16:30:00Z")).toISOString()).toBe("2026-11-09T16:30:00.000Z");
  });
});
