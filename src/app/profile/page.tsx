import { auth } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return <main className="min-h-screen bg-[var(--canvas)] text-[color:var(--ink)]"><header className="border-b border-[var(--line)] bg-[var(--surface)] px-6 py-4"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/app"><BrandMark/></Link><Link className="text-sm text-[color:var(--accent)] underline-offset-4 hover:underline" href="/app">Back to workspace</Link></div></header><div className="mx-auto max-w-2xl px-6 py-14"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[color:var(--accent)]">Account</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Profile & settings</h1><p className="mt-3 text-[color:var(--muted-ink)]">Your connected Google account and display preferences.</p><section className="mt-10 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><h2 className="font-semibold">Google account</h2><p className="mt-4 text-sm text-[color:var(--muted-ink)]">Name</p><p className="mt-1 break-words">{session.user.name || "Not provided"}</p><p className="mt-5 text-sm text-[color:var(--muted-ink)]">Email</p><p className="mt-1 break-all">{session.user.email || "Not provided"}</p></section><section className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"><div><h2 className="font-semibold">Appearance</h2><p className="mt-1 text-sm text-[color:var(--muted-ink)]">Choose a comfortable reading mode.</p></div><ThemeToggle/></section></div></main>;
}
