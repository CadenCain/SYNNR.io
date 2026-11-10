import Link from "next/link";
import { safeNext } from "@/lib/saas/safe-next";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import { isDemoUser, SELF_SERVE_OPEN } from "@/lib/saas/plan";
import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started · SYNNR" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const { next, invite } = await searchParams;
  const raw = next || (invite ? `/invite/${invite}` : "");
  const nextPath = safeNext(raw, "/app");
  // Early access: a new company starts with a call, not a form. (A crew
  // invite makes its login on the invite page, so nobody needs this one.)
  if (!SELF_SERVE_OPEN) redirect("/#access");
  const user = await getSaasUser();
  // Still signed into the live demo? Leave it and come back here to sign up.
  if (user && isDemoUser(user)) redirect("/demo/exit?to=signup");
  if (user) redirect(nextPath);
  return (
    <div className="flex flex-col gap-6">
      <div>
        {invite || next?.startsWith("/invite/") ? null : <p className="text-sm text-ink-faint">Step 1 of 3</p>}
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">Create your login</h1>
        <p className="mt-1.5 text-sm text-ink-dim">Yours alone. Everyone you bring in later gets their own.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-ink-dim">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
