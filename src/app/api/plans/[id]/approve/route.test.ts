import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getCalendarAuth: vi.fn(),
  getTasksAuth: vi.fn(),
  getGmailAuth: vi.fn(),
  getOwnedPendingActionType: vi.fn(),
  claimActionPlan: vi.fn(),
  createCalendarEvent: vi.fn(),
  createGoogleTask: vi.fn(),
  sendGmailMessage: vi.fn(),
  recordActionOutcome: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/integrations/google/connection", () => ({
  getCalendarAuth: mocks.getCalendarAuth,
  getTasksAuth: mocks.getTasksAuth,
  getGmailAuth: mocks.getGmailAuth,
  CalendarConnectionUnavailable: class extends Error {},
}));
vi.mock("@/lib/db/repositories/plans", () => ({ claimActionPlan: mocks.claimActionPlan, getOwnedPendingActionType: mocks.getOwnedPendingActionType }));
vi.mock("@/lib/integrations/google/calendar", () => ({
  createCalendarEvent: mocks.createCalendarEvent,
  CalendarWriteError: class extends Error {},
}));
vi.mock("@/lib/integrations/google/tasks", () => ({ createGoogleTask: mocks.createGoogleTask, TaskWriteError: class extends Error {} }));
vi.mock("@/lib/integrations/google/gmail", () => ({ sendGmailMessage: mocks.sendGmailMessage, GmailWriteError: class extends Error {} }));
vi.mock("@/lib/db/repositories/action-outcome", () => ({ recordActionOutcome: mocks.recordActionOutcome }));

import { POST } from "./route";
import { canonicalActionHash } from "@/lib/agent/plan";

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
    mocks.getTasksAuth.mockResolvedValue({});
    mocks.getGmailAuth.mockResolvedValue({});
    mocks.getOwnedPendingActionType.mockResolvedValue("calendar.create_event");
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
    expect(mocks.claimActionPlan).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated approval before loading a credential", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(401);
    expect(mocks.getCalendarAuth).not.toHaveBeenCalled();
    expect(mocks.claimActionPlan).not.toHaveBeenCalled();
  });

  it("requires exact confirmation and treats an unowned or duplicate claim as stale", async () => {
    expect((await POST(request(undefined, { ...approval, confirmation: false }), context)).status).toBe(400);
    expect(mocks.claimActionPlan).not.toHaveBeenCalled();

    mocks.claimActionPlan.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.claimActionPlan).toHaveBeenCalledWith(planId, "owner-A", approval);
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
  });

  it("executes one owned, exact-hash Task only with Tasks credentials", async () => {
    const task = { tool: "tasks.create_task" as const, args: { title: "Prepare synthetic demo", dueDate: "2026-11-11" } };
    const taskApproval = { ...approval, canonicalHash: canonicalActionHash(task) };
    mocks.getOwnedPendingActionType.mockResolvedValue("tasks.create_task");
    mocks.claimActionPlan.mockResolvedValue({
      plan: { canonicalHash: taskApproval.canonicalHash },
      action: { id: "33333333-3333-4333-8333-333333333333", type: task.tool, argumentsJson: task.args },
    });
    mocks.createGoogleTask.mockResolvedValue({ providerObjectId: "real-task-id" });
    const response = await POST(request(undefined, taskApproval), context);
    expect(response.status).toBe(200);
    expect((await response.json()).providerObjectId).toBe("real-task-id");
    expect(mocks.getTasksAuth).toHaveBeenCalledWith("owner-A");
    expect(mocks.getCalendarAuth).not.toHaveBeenCalled();
    expect(mocks.createGoogleTask).toHaveBeenCalledOnce();
    expect(mocks.recordActionOutcome).toHaveBeenCalledWith("owner-A", planId, "33333333-3333-4333-8333-333333333333", "google_tasks", { status: "succeeded", providerObjectId: "real-task-id" });
  });

  it("does not load credentials or write for an unowned Task plan", async () => {
    mocks.getOwnedPendingActionType.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.getOwnedPendingActionType).toHaveBeenCalledWith(planId, "owner-A");
    expect(mocks.getTasksAuth).not.toHaveBeenCalled();
    expect(mocks.claimActionPlan).not.toHaveBeenCalled();
    expect(mocks.createGoogleTask).not.toHaveBeenCalled();
  });

  it("sends only the exact approved Gmail action through Gmail scope", async () => {
    const mail = { tool: "gmail.send" as const, args: { to: "test@example.com", subject: "Synthetic update", body: "This is a synthetic test." } };
    const mailApproval = { ...approval, canonicalHash: canonicalActionHash(mail) };
    mocks.getOwnedPendingActionType.mockResolvedValue("gmail.send");
    mocks.claimActionPlan.mockResolvedValue({
      plan: { canonicalHash: mailApproval.canonicalHash },
      action: { id: "33333333-3333-4333-8333-333333333333", type: mail.tool, argumentsJson: mail.args },
    });
    mocks.sendGmailMessage.mockResolvedValue({ providerObjectId: "gmail-message-id" });
    const response = await POST(request(undefined, mailApproval), context);
    expect(response.status).toBe(200);
    expect((await response.json()).providerObjectId).toBe("gmail-message-id");
    expect(mocks.getGmailAuth).toHaveBeenCalledWith("owner-A");
    expect(mocks.getCalendarAuth).not.toHaveBeenCalled();
    expect(mocks.getTasksAuth).not.toHaveBeenCalled();
    expect(mocks.sendGmailMessage).toHaveBeenCalledWith(mail, {});
  });
});
