import type { Metadata } from "next";
import { HardHat } from "lucide-react";
import { saasAdmin } from "@/lib/saas/db";
import { isWritable } from "@/lib/saas/entitlements";
import SubmitForm from "./submit-form";

/**
 * PUBLIC crew document upload — the link a safety manager texts a hand when a
 * card renews. No auth, no app nav: the unguessable token scopes everything
 * (same trust model as /proof). Server-validates with the service role, then
 * hands off to a phone-first form.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Card update · SYNNR",
  robots: { index: false, follow: false },
};

function Invalid({ reason }: { reason: string }) {
  return (
    <div className="saas flex min-h-dvh items-center justify-center bg-coal px-4 text-ink antialiased">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">This link is {reason}.</p>
        <p className="mt-1 text-sm text-ink-dim">Ask the office to send a fresh one.</p>
      </div>
    </div>
  );
}

export default async function DocUpdatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin) return <Invalid reason="unavailable" />;

  const { data: reqData } = await admin
    .from("saas_doc_requests")
    .select("id, company_id, crew_member_id, status, expires_at, kind_hint")
    .eq("token", token).maybeSingle();
  const req = reqData as { id: string; company_id: string; crew_member_id: string; status: string; expires_at: string; kind_hint: string | null } | null;
  if (!req) return <Invalid reason="not valid" />;
  if (req.status === "done" || req.status === "revoked") return <Invalid reason="closed" />;
  if (new Date(req.expires_at) < new Date()) return <Invalid reason="expired" />;

  const [{ data: crewData }, { data: coData }] = await Promise.all([
    admin.from("saas_crew_members").select("name").eq("id", req.crew_member_id).maybeSingle(),
    admin.from("saas_companies").select("name, subscription_status, comped").eq("id", req.company_id).maybeSingle(),
  ]);
  const crewName = (crewData as { name: string } | null)?.name ?? "there";
  const co = coData as { name: string; subscription_status: string; comped: boolean } | null;
  if (!co || !isWritable(co.subscription_status, co.comped)) return <Invalid reason="paused — tell your manager" />;

  return (
    <div className="saas min-h-dvh bg-coal px-4 py-8 text-ink antialiased">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
            <HardHat className="h-5 w-5 text-ink-dim" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight">Hey {crewName.split(" ")[0]} —</p>
            <p className="text-sm text-ink-dim">{co.name} needs a photo of your renewed card.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <SubmitForm token={token} kindHint={req.kind_hint} alreadySubmitted={req.status === "submitted"} />
        </div>
        <p className="text-center text-xs text-ink-faint">
          Takes about 30 seconds. The photo goes straight to your safety manager — nowhere else.
        </p>
      </div>
    </div>
  );
}
