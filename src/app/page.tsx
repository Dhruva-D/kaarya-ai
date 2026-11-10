import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F6F6F3] px-6 py-12 text-[#222A2B] sm:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-[#166B61]">Kaarya AI</p>
        <h1 className="mt-20 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Speak naturally. Review every action.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#5A6664]">
          Speak in an Indian language or type a request. Kaarya uses Gnani AI for speech,
          drafts a Calendar event, Google Task or email, and shows the exact details before you approve a Google action.
        </p>
        <p className="mt-6 max-w-xl border-l-2 border-[#166B61] pl-4 text-sm leading-6 text-[#5A6664]">
          Try: “Schedule a project review tomorrow at five for 30 minutes.” Kaarya will ask about guests and a Meet link before creating it.
        </p>
        <Link className="mt-8 inline-flex min-h-11 items-center rounded-[10px] border border-[#166B61] px-5 font-medium text-[#166B61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" href="/app">Open Kaarya</Link>
      </div>
    </main>
  );
}
