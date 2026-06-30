import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSaasUser } from "@/lib/saas/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join · SYNNR", robots: { index: false, follow: false } };

async function accept(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  if (!sb) redirect("/login");
  const { error } = await sb.rpc("saas_accept_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  redirect("/app");
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = (await getServerSupabase()) as unknown as SupabaseClient | null;
  let preview: { company_name: string; role: string; valid: boolean } | null = null;
  if (sb) {
    const { data } = await sb.rpc("saas_invitation_preview", { p_token: token });
    preview = (Array.isArray(data) ? data[0] : data) ?? null;
  }
  const user = await getSaasUser();

  return (
    <div className="saas flex min-h-dvh items-center justify-center bg-coal px-4 text-ink antialiased">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
            <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
          </svg>
          <span className="font-semibold tracking-tight">SYNNR</span>
        </div>

        {!preview || !preview.valid ? (
          <>
            <h1 className="text-lg font-semibold">Invite not valid</h1>
            <p className="mt-1 text-sm text-ink-dim">This invite link is expired or has already been used.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-[#e7ddc7] hover:underline">← Home</Link>
          </>
        ) : !user ? (
          <>
            <h1 className="text-lg font-semibold">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;ve been invited as {preview.role}. Log in or start free, then open this link again to accept.</p>
            <div className="mt-4 flex gap-2">
              <Link href="/login" className="flex-1"><Button className="w-full" variant="outline">Log in</Button></Link>
              <Link href="/signup" className="flex-1"><Button className="w-full">Start free</Button></Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Join {preview.company_name}</h1>
            <p className="mt-1 text-sm text-ink-dim">You&apos;ll join as {preview.role}.</p>
            <form action={accept} className="mt-4">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full">Accept &amp; join</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
