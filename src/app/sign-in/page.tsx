import { signIn } from "@/auth";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.DATABASE_URL && process.env.TOKEN_ENCRYPTION_KEY);
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[color:var(--ink)]">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10"><Link href="/"><BrandMark/></Link><ThemeToggle/></header>
      <div className="mx-auto grid max-w-5xl gap-12 px-6 pb-16 pt-12 lg:grid-cols-2 lg:items-center lg:pt-24"><section><p className="text-xs font-bold uppercase tracking-[.2em] text-[color:var(--accent)]">A workspace that listens</p><h1 className="mt-5 text-5xl font-semibold leading-tight tracking-[-.05em]">Come in.<br/>Get things moving.</h1><p className="mt-6 max-w-md text-lg leading-8 text-[color:var(--muted-ink)]">Your voice and your decisions stay at the center. Speak, review the plan, then approve the action.</p><div className="mt-9 flex items-start gap-3 text-sm text-[color:var(--muted-ink)]"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-[color:var(--accent)]"/><span>Calendar, Tasks and Gmail permissions are used only when you approve the exact action.</span></div></section><section className="rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[0_22px_70px_rgba(22,39,34,.07)] sm:p-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[color:var(--accent)]">Sign in</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">Your Kaarya workspace</h2><p className="mt-3 text-sm leading-6 text-[color:var(--muted-ink)]">Continue with the Google account whose Calendar, Tasks and Gmail you want to connect.</p>
        {configured ? (
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/app" }); }}>
            <button className="mt-8 flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-5 font-semibold kaarya-on-accent hover:opacity-90" type="submit">Continue with Google <ArrowRight size={18}/></button>
          </form>
        ) : <p className="mt-8 rounded-[10px] border border-[var(--line)] bg-white p-4 text-sm">Sign-in is not available yet. Please try again once this workspace is connected.</p>}
        <Link className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm text-[color:var(--muted-ink)] hover:text-[color:var(--accent)]" href="/"><ArrowLeft size={16}/> Back to home</Link></section></div>
    </main>
  );
}
