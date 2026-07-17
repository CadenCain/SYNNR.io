import Link from "next/link";
import ForgotForm from "./forgot-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password · RollReady" };

export default function ForgotPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-dim">We&apos;ll email you a link to set a new one.</p>
      </div>
      <ForgotForm />
      <p className="text-center text-sm text-ink-dim">
        <Link href="/login" className="font-medium text-[#e7ddc7] hover:underline">← Back to log in</Link>
      </p>
    </div>
  );
}
