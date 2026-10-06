import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, TriangleAlert, FileImage, ArrowRight } from "lucide-react";
import { saasAdmin } from "@/lib/saas/db";
import { getSaasUser } from "@/lib/saas/auth";
import { judgeItem, type LineResult } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { categoryLabel } from "@/lib/saas/taxonomy";
import { fmtDate, fmtWhen } from "@/lib/saas/format";

/**
 * What a QR tag opens. Anyone who scans the tag on a piece of iron (a hand,
 * the company man on location, an inspector) sees what it is, whether it's
 * good, its test dates, and the paper behind them. No login.
 *
 * Read-only, one asset, looked up by its unguessable tag token with the
 * service-role client. Nothing else about the company is shown.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Equipment tag · RollReady",
  robots: { index: false, follow: false },
};

const CHIP: Record<LineResult, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  due_soon: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  expired: "border-red-500/40 bg-red-500/10 text-red-400",
  missing: "border-red-500/40 bg-red-500/10 text-red-400",
};
const LABEL: Record<LineResult, string> = { ok: "Current", due_soon: "Due soon", pending: "Retested, cert on the way", expired: "Expired", missing: "No date" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="saas min-h-dvh bg-coal px-4 py-8 text-ink antialiased">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
            <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#1d4ed8" />
          </svg>
          <span className="font-semibold tracking-tight">RollReady</span>
          <span className="text-sm text-ink-faint">Equipment tag</span>
        </div>
        {children}
        <p className="text-center text-xs text-ink-faint">
          Live from the shop&apos;s records in RollReady by SYNNR · <Link href="/" className="underline underline-offset-2">synnr.io</Link>
        </p>
      </div>
    </div>
  );
}

export default async function TagPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin || !/^[a-f0-9]{16,64}$/.test(token)) {
    return <Shell><div className="rounded-2xl border border-line bg-surface p-6 text-center font-semibold">This tag isn&apos;t in RollReady.</div></Shell>;
  }

  const { data: assetData } = await admin.from("saas_assets")
    .select("id, company_id, name, category, identifier, status")
    .eq("tag_token", token).maybeSingle();
  const a = assetData as { id: string; company_id: string; name: string; category: string; identifier: string | null; status: string } | null;
  if (!a) {
    return <Shell><div className="rounded-2xl border border-line bg-surface p-6 text-center"><p className="font-semibold">This tag isn&apos;t in RollReady.</p><p className="mt-1 text-sm text-ink-dim">The iron may have been removed from the shop&apos;s records. Ask the shop.</p></div></Shell>;
  }

  // Someone from the shop scanning its own iron gets a way into the app to
  // move it or upload its new cert. Everyone else sees the public view only.
  const memberCheck = (async () => {
    const user = await getSaasUser();
    if (!user) return false;
    const { data } = await admin.from("saas_memberships").select("user_id")
      .eq("company_id", a.company_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    return Boolean(data);
  })();

  const [{ data: co }, { data: itemData }, isMember] = await Promise.all([
    admin.from("saas_companies").select("name").eq("id", a.company_id).maybeSingle(),
    admin.from("saas_compliance_items")
      .select("id, title, issued_date, expiration_date, reminder_days, pending_until, last_upload_id")
      .eq("company_id", a.company_id).eq("parent_type", "asset").eq("parent_id", a.id),
    memberCheck,
  ]);
  const companyName = (co as { name: string } | null)?.name ?? "";
  type I = { id: string; title: string; issued_date: string | null; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null };
  const today = localToday();
  const rank: Record<LineResult, number> = { expired: 0, missing: 1, pending: 2, due_soon: 3, ok: 4 };
  const items = ((itemData ?? []) as I[])
    .map((i) => ({ i, j: judgeItem(i, today, today) }))
    .sort((x, y) => rank[x.j.result] - rank[y.j.result] || (x.i.expiration_date ?? "").localeCompare(y.i.expiration_date ?? ""));

  // The photo behind each current date.
  const paper = new Map<string, string>();
  const uploadIds = items.map((x) => x.i.last_upload_id).filter((x): x is string => Boolean(x));
  if (uploadIds.length) {
    const { data: ups } = await admin.from("saas_cert_uploads").select("id, item_id, storage_path").in("id", uploadIds);
    const list = (ups ?? []) as { id: string; item_id: string; storage_path: string }[];
    if (list.length) {
      const { data: signed } = await admin.storage.from("proofs").createSignedUrls(list.map((u) => u.storage_path), 3600);
      list.forEach((u, idx) => { const url = signed?.[idx]?.signedUrl; if (url) paper.set(u.item_id, url); });
    }
  }

  const down = a.status === "out_of_service" || a.status === "missing";
  const retired = a.status === "retired";
  const failing = items.filter((x) => x.j.result === "expired" || x.j.result === "missing");
  const good = !down && !retired && items.length > 0 && failing.length === 0;
  const verdict = retired ? { title: "Retired", tone: "border-line-2 bg-elevated text-ink-dim", note: "The shop has taken this out of service for good. Don't use it." }
    : a.status === "out_of_service" ? { title: "Red-tagged. Do not use.", tone: "border-red-500/40 bg-red-500/10 text-red-400", note: "The shop has pulled this from service." }
    : a.status === "missing" ? { title: "Flagged missing", tone: "border-red-500/40 bg-red-500/10 text-red-400", note: "The shop has this marked missing. Let them know where it is." }
    : items.length === 0 ? { title: "No test on file", tone: "border-line-2 bg-elevated text-ink-dim", note: "The shop hasn't put this piece's paper in RollReady yet." }
    : failing.length ? { title: "Out of test", tone: "border-red-500/40 bg-red-500/10 text-red-400", note: failing.length === 1 ? `${failing[0].i.title}: ${failing[0].j.detail}.` : `${failing.length} tests are past due or missing a date.` }
    : { title: "Current", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", note: "Every test and cert on file is current today." };

  return (
    <Shell>
      {isMember ? (
        <Link href={`/app/assets/${a.id}`}
          className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-bone px-5 py-3 font-semibold text-white hover:bg-bone-soft">
          <span>Open it in RollReady to move it or upload a new cert</span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      ) : null}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="text-sm text-ink-faint">{companyName}</div>
        <h1 className="mt-0.5 break-words text-2xl font-semibold tracking-tight">{a.name}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-ink-faint">Serial</dt><dd className="break-words font-medium">{a.identifier ?? "None on file"}</dd></div>
          <div><dt className="text-xs text-ink-faint">Type</dt><dd className="font-medium">{categoryLabel(a.category)}</dd></div>
        </dl>
      </div>

      <div className={`rounded-2xl border p-5 ${verdict.tone}`}>
        <div className="flex items-center gap-2.5 text-xl font-semibold">
          {good ? <ShieldCheck className="h-6 w-6 shrink-0" /> : <TriangleAlert className="h-6 w-6 shrink-0" />}
          {verdict.title}
        </div>
        <p className="mt-1 text-sm text-ink-dim">{verdict.note}</p>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Tests and certs</h2>
          {items.map(({ i, j }) => (
            <div key={i.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 break-words font-semibold">{i.title}</div>
                <span className={`inline-flex shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${CHIP[j.result]}`}>{LABEL[j.result]}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-ink-faint">Last done</dt><dd className="whitespace-nowrap">{i.issued_date ? fmtDate(i.issued_date) : "Not on file"}</dd></div>
                <div><dt className="text-xs text-ink-faint">Good until</dt><dd className="whitespace-nowrap">{i.expiration_date ? fmtDate(i.expiration_date) : "No date"}</dd></div>
              </dl>
              {paper.get(i.id) ? (
                <a href={paper.get(i.id)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-bone underline underline-offset-2">
                  <FileImage className="h-4 w-4" /> See the cert
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">Checked {fmtWhen(new Date().toISOString())}</p>
    </Shell>
  );
}
