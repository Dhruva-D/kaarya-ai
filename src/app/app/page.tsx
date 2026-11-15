import { auth, signOut } from "@/auth";
import { Workspace } from "@/components/chat/workspace";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { AccountMenu } from "@/components/account-menu";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET || !process.env.DATABASE_URL || !process.env.TOKEN_ENCRYPTION_KEY) redirect("/sign-in");
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[color:var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--surface)] px-5 py-4 sm:px-8"><div className="mx-auto flex max-w-[1600px] items-center justify-between"><Link href="/"><BrandMark/></Link><span className="hidden text-xs font-medium uppercase tracking-[.15em] text-[color:var(--muted-ink)] sm:inline">Your workspace</span></div></header>
      <Workspace senderEmail={session.user.email ?? null} voiceAvailable={Boolean(process.env.GNANI_API_KEY)} signOutControl={<AccountMenu name={session.user.name} email={session.user.email} signOutControl={<form action={async () => { "use server"; await signOut({ redirectTo: "/sign-in" }); }}><button className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-[var(--soft)]" type="submit">Sign out</button></form>}/>} />
    </main>
  );
}
