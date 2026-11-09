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
          A multilingual voice-to-action workspace is being built here. Provider connections and
          external actions are not available yet.
        </p>
        <Link className="mt-8 inline-flex min-h-11 items-center rounded-[10px] border border-[#166B61] px-5 font-medium text-[#166B61] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" href="/sign-in">Sign in</Link>
      </div>
    </main>
  );
}
