import type { CalendarHistoryItem } from "./types";

const statusLabel = { succeeded: "Created", failed: "Failed", unknown: "Check Calendar" } as const;

export function ActionHistory({ items }: { items: CalendarHistoryItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-actions-title" className="mt-5 border-t border-[#E3E7E3] pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6664]" id="recent-actions-title">Recent actions</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item) => <li className="rounded-[10px] border border-[#E3E7E3] bg-white p-3" key={item.planId}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-sm font-semibold text-[#222A2B]">{item.title}</p>
            <span className={`shrink-0 text-xs font-medium ${item.status === "succeeded" ? "text-[#166B61]" : "text-[#8E392F]"}`}>{statusLabel[item.status]}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#5A6664]">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: item.timezone }).format(new Date(item.startIso))}</p>
          {item.status === "succeeded" && item.providerLink && <a className="mt-2 inline-block text-xs font-medium text-[#166B61] underline underline-offset-2" href={item.providerLink} rel="noopener noreferrer" target="_blank">Open in Google Calendar</a>}
          {item.status === "unknown" && <p className="mt-2 text-xs leading-5 text-[#8E392F]">The result could not be confirmed. Check Calendar before retrying.</p>}
        </li>)}
      </ol>
    </section>
  );
}
