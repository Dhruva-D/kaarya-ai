import type { TaskAction } from "./plan";

export function validateTaskProposal(action: TaskAction, now = new Date()): TaskAction {
  if (action.args.dueDate) {
    const due = new Date(`${action.args.dueDate}T00:00:00Z`);
    if (!Number.isFinite(due.getTime())) throw new Error("Task due date is invalid");
    if (due.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 24 * 60 * 60 * 1_000) throw new Error("Task due date is in the past");
    if (due.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1_000) throw new Error("Task due date is too far away");
  }
  return action;
}
