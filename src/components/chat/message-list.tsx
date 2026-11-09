import type { Turn } from "./types";

export function MessageList({ messages, busy }: { messages: Turn[]; busy: boolean }) {
  return (
    <div aria-live="polite" className="space-y-7">
      {messages.map((message) => (
        <article className={`max-w-[90%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`} key={message.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5A6664]">{message.role === "user" ? "You" : "Kaarya"}</p>
          <div className={`whitespace-pre-wrap break-words rounded-[14px] px-4 py-3 text-[15px] leading-7 ${message.role === "user" ? "bg-[#E7EFEC]" : "border border-[#E3E7E3] bg-white"}`}>{message.content}</div>
        </article>
      ))}
      {busy && <p className="text-sm text-[#5A6664]" role="status">Preparing a response…</p>}
    </div>
  );
}
