import { google } from "googleapis";
import type { TaskAction } from "../../agent/plan";

type TasksAuth = InstanceType<typeof google.auth.OAuth2>;
type InsertParams = { tasklist: "@default"; requestBody: { title: string; notes?: string; due?: string } };
type InsertResult = { data: { id?: string | null; title?: string | null; webViewLink?: string | null } };
type TaskInsert = (params: InsertParams) => Promise<InsertResult>;

export class TaskWriteError extends Error {
  constructor(public readonly outcome: "failed" | "unknown", message: string) { super(message); }
}

export async function createGoogleTask(action: TaskAction, auth: TasksAuth, insertOverride?: TaskInsert): Promise<{ providerObjectId: string; providerLink?: string }> {
  const insert = insertOverride ?? (async (params: InsertParams) => {
    const response = await google.tasks({ version: "v1", auth }).tasks.insert(params, { timeout: 30_000 });
    return { data: response.data };
  });
  let result: InsertResult;
  try {
    result = await insert({
      tasklist: "@default",
      requestBody: {
        title: action.args.title,
        ...(action.args.notes ? { notes: action.args.notes } : {}),
        ...(action.args.dueDate ? { due: `${action.args.dueDate}T00:00:00.000Z` } : {}),
      },
    });
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status && status >= 400 && status < 500 && status !== 409 && status !== 429) {
      throw new TaskWriteError("failed", `Google Tasks rejected the task (HTTP ${status})`);
    }
    throw new TaskWriteError("unknown", "Google Tasks may have created this task; confirmation was lost");
  }
  if (!result.data.id || result.data.title !== action.args.title) throw new TaskWriteError("unknown", "Google Tasks did not return a matching task receipt");
  const link = result.data.webViewLink;
  const safeLink = link && URL.canParse(link) && (() => {
    const url = new URL(link);
    return url.protocol === "https:" && url.hostname === "tasks.google.com";
  })() ? link : undefined;
  return { providerObjectId: result.data.id, providerLink: safeLink };
}
