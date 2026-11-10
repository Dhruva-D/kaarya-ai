import { describe, expect, it, vi } from "vitest";
import { createGoogleTask } from "./tasks";

const action = { tool: "tasks.create_task" as const, args: { title: "Prepare synthetic demo", notes: "Use synthetic details", dueDate: "2026-11-11" } };
const auth = {} as Parameters<typeof createGoogleTask>[1];

describe("Google Tasks adapter", () => {
  it("uses the default list and date-only due value", async () => {
    const insert = vi.fn(async (params) => {
      expect(params.tasklist).toBe("@default");
      expect(params.requestBody).toEqual({ title: action.args.title, notes: action.args.notes, due: "2026-11-11T00:00:00.000Z" });
      return { data: { id: "task-id", title: action.args.title, webViewLink: "https://tasks.google.com/task/123" } };
    });
    expect(await createGoogleTask(action, auth, insert)).toEqual({ providerObjectId: "task-id", providerLink: "https://tasks.google.com/task/123" });
  });
  it("does not report uncertain outcomes as success", async () => {
    await expect(createGoogleTask(action, auth, async () => ({ data: { id: "task-id", title: "Different task" } }))).rejects.toMatchObject({ outcome: "unknown" });
    await expect(createGoogleTask(action, auth, async () => { throw new Error("timeout"); })).rejects.toMatchObject({ outcome: "unknown" });
    await expect(createGoogleTask(action, auth, async () => { throw { response: { status: 403 } }; })).rejects.toMatchObject({ outcome: "failed" });
  });
});
