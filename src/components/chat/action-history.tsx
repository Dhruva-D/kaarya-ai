import type { ActionHistoryItem } from "./types";

function statusLabel(item: ActionHistoryItem): string {
  if (item.status !== "succeeded") return item.status === "failed" ? "Failed" : "Check app";
  return item.tool === "gmail.send" ? "Sent" : "Created";
}

export function ActionHistory({ items }: { items: ActionHistoryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-actions-title" className="mt-5 border-t border-[var(--line)] pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-ink)]" id="recent-actions-title">Recent actions</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item) => <li className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] p-3" key={item.actionId}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-[color:var(--ink)]">{item.title}</p>
            <span className={`shrink-0 text-xs font-medium ${item.status === "succeeded" ? "text-[color:var(--accent)]" : "text-[var(--danger)]"}`}>{statusLabel(item)}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[color:var(--muted-ink)]">{item.tool === "calendar.create_event" ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: item.timezone }).format(new Date(item.startIso)) : item.tool === "gmail.send" ? `To ${item.to}` : item.dueDate ? `Due ${item.dueDate}` : "No due date"}</p>
          {item.status === "succeeded" && item.providerLink && <a className="mt-2 inline-block text-xs font-medium text-[color:var(--accent)] underline underline-offset-2" href={item.providerLink} rel="noopener noreferrer" target="_blank">Open in Google {item.tool === "calendar.create_event" ? "Calendar" : "Tasks"}</a>}
          {item.status === "unknown" && <p className="mt-2 text-xs leading-5 text-[var(--danger)]">The result could not be confirmed. Check {item.tool === "calendar.create_event" ? "Google Calendar" : item.tool === "tasks.create_task" ? "Google Tasks" : "Gmail Sent"} before retrying.</p>}
        </li>)}
      </ol>
    </section>
  );
}
