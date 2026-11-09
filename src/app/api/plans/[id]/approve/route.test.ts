import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getCalendarAuth: vi.fn(),
  claimCalendarPlan: vi.fn(),
  createCalendarEvent: vi.fn(),
  recordCalendarOutcome: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/integrations/google/connection", () => ({
  getCalendarAuth: mocks.getCalendarAuth,
  CalendarConnectionUnavailable: class extends Error {},
}));
vi.mock("@/lib/db/repositories/plans", () => ({ claimCalendarPlan: mocks.claimCalendarPlan }));
vi.mock("@/lib/integrations/google/calendar", () => ({
  createCalendarEvent: mocks.createCalendarEvent,
  CalendarWriteError: class extends Error {},
}));
vi.mock("@/lib/db/repositories/action-outcome", () => ({ recordCalendarOutcome: mocks.recordCalendarOutcome }));

import { POST } from "./route";

const planId = "11111111-1111-4111-8111-111111111111";
const approval = {
  planVersion: 1,
  canonicalHash: "a".repeat(64),
  confirmation: true,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
};
const context = { params: Promise.resolve({ id: planId }) };
const url = "http://localhost:3000/api/plans/" + planId + "/approve";

function request(origin = "http://localhost:3000", body: unknown = approval) {
  return new Request(url, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("Calendar approval route guards", () => {
  const priorDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://local.invalid/test";
    mocks.auth.mockResolvedValue({ user: { id: "owner-A" } });
    mocks.getCalendarAuth.mockResolvedValue({});
  });

  afterEach(() => {
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
  });

  it("rejects a foreign origin before loading a credential or claiming a plan", async () => {
    const response = await POST(request("https://foreign.example"), context);
    expect(response.status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.getCalendarAuth).not.toHaveBeenCalled();
    expect(mocks.claimCalendarPlan).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated approval before loading a credential", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(401);
    expect(mocks.getCalendarAuth).not.toHaveBeenCalled();
    expect(mocks.claimCalendarPlan).not.toHaveBeenCalled();
  });

  it("requires exact confirmation and treats an unowned or duplicate claim as stale", async () => {
    expect((await POST(request(undefined, { ...approval, confirmation: false }), context)).status).toBe(400);
    expect(mocks.claimCalendarPlan).not.toHaveBeenCalled();

    mocks.claimCalendarPlan.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.claimCalendarPlan).toHaveBeenCalledWith(planId, "owner-A", approval);
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
  });
});
