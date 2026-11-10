import { signIn } from "@/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const configured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.DATABASE_URL && process.env.TOKEN_ENCRYPTION_KEY);
  return (
    <main className="min-h-screen bg-[#F6F6F3] px-6 py-12 text-[#222A2B]">
      <div className="mx-auto max-w-md pt-20">
        <p className="font-semibold text-[#166B61]">Kaarya AI</p>
        <h1 className="mt-8 text-3xl font-semibold">Sign in to your workspace</h1>
        <p className="mt-3 text-[#5A6664]">Google will ask for Calendar, Tasks and Gmail send access. Kaarya uses those permissions only after you review and approve an action.</p>
        {configured ? (
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/app" }); }}>
            <button className="mt-8 min-h-11 rounded-[10px] bg-[#166B61] px-5 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" type="submit">Continue with Google</button>
          </form>
        ) : <p className="mt-8 rounded-[10px] border border-[#E3E7E3] bg-white p-4 text-sm">Sign-in is not available yet. Please try again once this workspace is connected.</p>}
        <Link className="mt-6 inline-block text-sm text-[#166B61] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166B61]" href="/">Back to home</Link>
      </div>
    </main>
  );
}
