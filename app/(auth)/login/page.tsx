import Link from "next/link";
import { safeNext } from "@/lib/saas/safe-next";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import { isDemoUser } from "@/lib/saas/plan";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · SYNNR" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const { next, invite } = await searchParams;
  const raw = next || (invite ? `/invite/${invite}` : "");
  const nextPath = safeNext(raw, "/app");
  const user = await getSaasUser();
  // Still signed into the live demo? Leave it and come back here to log in.
  if (user && isDemoUser(user)) redirect("/demo/exit?to=login");
  if (user) redirect(nextPath);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Log in</h1>
        <p className="mt-1.5 text-sm text-ink-dim">Welcome back.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-ink-dim">
        New here?{" "}
        <Link href="/#access" className="font-medium text-ink underline-offset-4 hover:underline">
          Request access
        </Link>
      </p>
    </div>
  );
}
