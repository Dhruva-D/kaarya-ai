import { auth, signOut } from "@/auth";
import { Workspace } from "@/components/chat/workspace";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  if (!process.env.AUTH_SECRET || !process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET || !process.env.DATABASE_URL || !process.env.TOKEN_ENCRYPTION_KEY) redirect("/sign-in");
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return (
    <main className="min-h-screen bg-[#F6F6F3] text-[#222A2B]">
      <header className="border-b border-[#E3E7E3] bg-white px-5 py-5 sm:px-8"><div className="mx-auto max-w-[1600px] text-lg font-semibold tracking-tight text-[#166B61]">Kaarya AI</div></header>
      <Workspace signOutControl={<form action={async () => { "use server"; await signOut({ redirectTo: "/sign-in" }); }}><button className="min-h-11 rounded-[10px] px-3 text-sm font-medium hover:bg-[#E7EFEC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" type="submit">Sign out</button></form>} />
    </main>
  );
}
