import Link from "next/link";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import { isDemoUser } from "@/lib/saas/plan";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · SYNNR" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const { next, invite } = await searchParams;
  const raw = next || (invite ? `/invite/${invite}` : "");
  const nextPath = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/app";
  const user = await getSaasUser();
  // Still signed into the live demo? Leave it and come back here to log in.
  if (user && isDemoUser(user)) redirect("/demo/exit?to=login");
  if (user) redirect(nextPath);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-1 text-sm text-ink-dim">Welcome back. Pick up where your yard left off.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-ink-dim">
        New here?{" "}
        <Link href="/signup" className="font-medium text-[#1d4ed8] hover:underline">
          Get started
        </Link>
      </p>
    </div>
  );
}
