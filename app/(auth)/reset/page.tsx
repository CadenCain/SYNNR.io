import ResetForm from "./reset-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set new password · RollReady" };

// The /auth/callback exchange establishes the session before this page loads.
export default function ResetPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-ink-dim">Pick something you&apos;ll remember.</p>
      </div>
      <ResetForm />
    </div>
  );
}
