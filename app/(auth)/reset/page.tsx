import Link from "next/link";
import { getSaasUser } from "@/lib/saas/auth";
import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set new password · RollReady" };

// The reset link (/auth/confirm) signs them in before this page loads.
export default async function ResetPage() {
  const user = await getSaasUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">That link didn&apos;t work</h1>
        <p className="text-sm text-ink-dim">It was already used or ran out. Send yourself a new one.</p>
        <Link href="/forgot" className="inline-flex h-12 items-center justify-center rounded-lg bg-bone px-4 text-base font-semibold text-on-bone">Send a new reset link</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-ink-dim">For {user.email}. Pick something you&apos;ll remember.</p>
      </div>
      <ResetForm />
    </div>
  );
}
