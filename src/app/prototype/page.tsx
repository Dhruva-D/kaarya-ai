import Link from "next/link";
import { auth } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { PrototypeWorkspace } from "@/components/prototype/prototype-workspace";

export const dynamic = "force-dynamic";
export default async function PrototypePage() {
  const session = process.env.AUTH_SECRET ? await auth() : null;
  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]"><header className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4"><div className="mx-auto flex max-w-[1450px] flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/"><BrandMark/></Link><span className="rounded-full border border-amber-500/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold">Client prototype</span></div><div className="flex items-center gap-4"><Link className="text-sm underline underline-offset-4" href="/app">Connected app</Link><ThemeToggle/></div></div></header><div className="border-b border-[var(--line)] px-5 py-3 text-center text-xs leading-5 text-[var(--muted-ink)]">Scripted walkthrough · sample data · simulated external actions. Voice uses Gnani when signed in.</div><PrototypeWorkspace voiceAvailable={Boolean(session?.user?.id && process.env.GNANI_API_KEY)}/></main>;
}
