import Link from "next/link";
import ForgotForm from "./forgot-form";
import { safeNext } from "@/lib/saas/password-reset";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password · SYNNR" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ expired?: string; next?: string }> }) {
  const { expired, next } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-dim">Type the email you log in with. We&apos;ll send a link to set a new password.</p>
      </div>
      {expired ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-400">That link was already used or ran out. Send yourself a new one.</p>
      ) : null}
      <ForgotForm next={safeNext(next)} />
      <p className="text-center text-sm text-ink-dim">
        <Link href={safeNext(next) ? `/login?next=${encodeURIComponent(safeNext(next))}` : "/login"} className="font-medium text-ink underline-offset-4 hover:underline">← Back to log in</Link>
      </p>
    </div>
  );
}
