import Link from "next/link";
import { Check, X } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isManagerRole } from "@/lib/saas/yard-rules";
import { usDate } from "@/lib/saas/cert-dates";
import { fmtWhen, fmtDate } from "@/lib/saas/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import ReviewButtons from "./review-buttons";

export const dynamic = "force-dynamic";

/**
 * The manager's desk. Uploads the software couldn't confirm wait here, the
 * item stays red until someone says yes, and anything that looks off in the
 * last 30 days is listed even when it went through: the same photo on two
 * items, a date that's a suspiciously round year out, a cert cleared right
 * before a truck rolled, a date a manager typed in without paper.
 */

interface Upload {
  id: string; item_id: string; uploaded_by_name: string | null; uploaded_by_role: string | null; created_at: string;
  storage_path: string; evidence: "cert" | "temporary"; claimed_expiration: string | null; pending_until: string | null;
  checks: { key: string; label: string; ok: boolean; detail: string }[]; flags: string[]; verdict: string; status: string;
  reviewed_by_name: string | null; reviewed_at: string | null; review_note: string | null; applied_at: string | null;
}
const COLS = "id, item_id, uploaded_by_name, uploaded_by_role, created_at, storage_path, evidence, claimed_expiration, pending_until, checks, flags, verdict, status, reviewed_by_name, reviewed_at, review_note, applied_at";

export default async function ReviewPage() {
  const { company } = await requireCompany();
  if (!isManagerRole(company.role)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Review uploads" description="Managers check uploads the software couldn't confirm." />
        <Card className="p-5 text-sm text-ink-dim">Only a manager can review uploads. Anything you upload that needs a look lands here for them.</Card>
      </div>
    );
  }
  const db = await saasDb();
  const since = new Date(Date.now() - 30 * 86400e3).toISOString();

  const [{ data: waitingData }, { data: recentData }, { data: typedData }, { data: itemData }, { data: unitData }, { data: assetData }, { data: checkData }] = await Promise.all([
    db.from("saas_cert_uploads").select(COLS).eq("company_id", company.id).eq("status", "waiting").order("created_at", { ascending: true }),
    db.from("saas_cert_uploads").select(COLS).eq("company_id", company.id).neq("status", "waiting").gte("created_at", since).order("created_at", { ascending: false }).limit(80),
    db.from("saas_compliance_items").select("id, title, parent_type, parent_id, expiration_date, updated_at").eq("company_id", company.id).neq("parent_type", "crew").eq("renewed_without_proof", true).order("updated_at", { ascending: false }).limit(40),
    db.from("saas_compliance_items").select("id, title, parent_type, parent_id").eq("company_id", company.id),
    db.from("saas_units").select("id, name").eq("company_id", company.id),
    db.from("saas_assets").select("id, name, unit_id").eq("company_id", company.id),
    db.from("saas_dispatch_checks").select("id, unit_id, started_at").eq("company_id", company.id).gte("started_at", since),
  ]);
  const waiting = (waitingData ?? []) as Upload[];
  const recent = (recentData ?? []) as Upload[];
  const typed = (typedData ?? []) as { id: string; title: string; parent_type: string; parent_id: string; expiration_date: string | null; updated_at: string }[];

  const items = new Map(((itemData ?? []) as { id: string; title: string; parent_type: string; parent_id: string }[]).map((i) => [i.id, i]));
  const units = new Map(((unitData ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
  const assets = new Map(((assetData ?? []) as { id: string; name: string; unit_id: string | null }[]).map((a) => [a.id, a]));

  const parentOf = (i: { parent_type: string; parent_id: string }) =>
    i.parent_type === "unit" ? { name: units.get(i.parent_id) ?? "truck", href: `/app/units/${i.parent_id}` }
    : i.parent_type === "asset" ? (() => {
        const a = assets.get(i.parent_id);
        const truck = a?.unit_id ? units.get(a.unit_id) : null;
        return { name: `${a?.name ?? "iron"}${truck ? ` on ${truck}` : ""}`, href: `/app/assets/${i.parent_id}` };
      })()
    : { name: "crew card", href: "/app" };
  const trucksFor = (itemId: string): string[] => {
    const i = items.get(itemId);
    if (!i) return [];
    if (i.parent_type === "unit") return [i.parent_id];
    if (i.parent_type === "asset") { const u = assets.get(i.parent_id)?.unit_id; return u ? [u] : []; }
    return [];
  };

  // Cleared right before a truck rolled: a readiness check on that truck
  // within 24 hours after the cert went green.
  const checks = (checkData ?? []) as { id: string; unit_id: string; started_at: string }[];
  const rightBeforeCheck = (u: Upload): string | null => {
    if (!u.applied_at || u.status === "rejected") return null;
    const t0 = Date.parse(u.applied_at);
    const trucks = new Set(trucksFor(u.item_id));
    const hit = checks.find((c) => trucks.has(c.unit_id) && Date.parse(c.started_at) >= t0 && Date.parse(c.started_at) - t0 <= 24 * 3600e3);
    if (!hit) return null;
    const hrs = Math.max(1, Math.round((Date.parse(hit.started_at) - t0) / 3600e3));
    return `Cleared ${hrs} hour${hrs === 1 ? "" : "s"} before a readiness check on ${units.get(hit.unit_id) ?? "the truck"}.`;
  };

  const shots = [...waiting, ...recent].map((u) => ({ id: u.id, path: u.storage_path }));
  const photo = new Map<string, string>();
  if (shots.length) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrls(shots.map((x) => x.path), 3600);
    shots.forEach((x, i) => { const url = signed?.[i]?.signedUrl; if (url) photo.set(x.id, url); });
  }

  const worth = recent
    .map((u) => ({ u, notes: [...u.flags, ...(rightBeforeCheck(u) ? [rightBeforeCheck(u) as string] : [])] }))
    .filter((x) => x.notes.length > 0);
  const decided = recent.filter((u) => u.status === "applied" || u.status === "rejected" || (u.status === "superseded" && u.applied_at)).slice(0, 25);

  const label = (itemId: string) => {
    const i = items.get(itemId);
    if (!i) return { title: "Deleted item", parent: null as null | { name: string; href: string } };
    return { title: i.title, parent: parentOf(i) };
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Review uploads" description="Uploads the software couldn't confirm wait here. The item stays red until you say yes." />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-dim">Waiting on you{waiting.length ? ` (${waiting.length})` : ""}</h2>
        {waiting.length === 0 ? (
          <Card className="p-5 text-sm text-ink-dim">Nothing waiting. When a photo doesn&apos;t match what was typed, or someone sends retest paper, it shows up here.</Card>
        ) : waiting.map((u) => {
          const l = label(u.item_id);
          return (
            <Card key={u.id} className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <div className="font-semibold">{l.title}{l.parent ? <span className="font-normal text-ink-dim"> · <Link href={l.parent.href} className="underline-offset-2 hover:underline">{l.parent.name}</Link></span> : null}</div>
                  <div className="text-sm text-ink-dim">
                    {u.uploaded_by_name ?? "Someone"} sent {u.evidence === "cert" ? "a new cert" : "retest paper (cert on the way)"} · {fmtWhen(u.created_at)}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                {photo.get(u.id) ? (
                  <a href={photo.get(u.id)} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.get(u.id)} alt={`Photo uploaded for ${l.title}`} className="max-h-96 w-full rounded-lg border border-line-2 bg-coal object-contain" />
                    <span className="mt-1 block text-xs text-ink-faint">Tap to open full size</span>
                  </a>
                ) : <div className="rounded-lg border border-line-2 p-4 text-sm text-ink-dim">The photo couldn&apos;t be loaded.</div>}
                <div className="flex flex-col gap-3">
                  <div className="text-sm">
                    {u.evidence === "cert"
                      ? <>Expiration they entered: <span className="font-semibold">{u.claimed_expiration ? usDate(u.claimed_expiration) : "none"}</span></>
                      : <>If you approve, it shows &quot;cert on the way&quot; through <span className="font-semibold">{u.pending_until ? fmtDate(u.pending_until) : "7 days"}</span>, then goes red again unless the real cert is uploaded.</>}
                  </div>
                  {u.checks.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-ink-faint">What the software found</div>
                      <ul className="flex flex-col gap-1 text-sm">
                        {u.checks.map((c) => (
                          <li key={c.key} className="flex gap-2">
                            {c.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                            <span className={c.ok ? "text-ink-dim" : "text-ink"}>{c.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {u.flags.length > 0 && (
                    <ul className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                      {u.flags.map((f) => <li key={f}>{f}</li>)}
                    </ul>
                  )}
                  <ReviewButtons uploadId={u.id} />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-dim">Worth a look (last 30 days)</h2>
        {worth.length === 0 && typed.length === 0 ? (
          <Card className="p-5 text-sm text-ink-dim">Nothing odd. This lists the same photo used twice, dates that are a suspiciously round year out, certs cleared right before a truck rolled, and dates typed in without a photo.</Card>
        ) : (
          <Card className="divide-y divide-line p-0">
            {worth.map(({ u, notes }) => {
              const l = label(u.item_id);
              return (
                <div key={u.id} className="flex flex-col gap-1 p-4">
                  <div className="text-sm font-medium">{l.title}{l.parent ? <span className="font-normal text-ink-dim"> · <Link href={l.parent.href} className="underline-offset-2 hover:underline">{l.parent.name}</Link></span> : null}</div>
                  {notes.map((n) => <p key={n} className="text-sm text-amber-300">{n}</p>)}
                  <p className="text-xs text-ink-faint">
                    {u.uploaded_by_name ?? "Someone"} · {fmtWhen(u.created_at)} · {u.status === "rejected" ? "turned down" : u.reviewed_by_name ? `approved by ${u.reviewed_by_name}` : "passed the photo check"}
                    {photo.get(u.id) ? <> · <a href={photo.get(u.id)} target="_blank" rel="noreferrer" className="text-bone underline underline-offset-2">photo</a></> : null}
                  </p>
                </div>
              );
            })}
            {typed.map((t) => {
              const p = parentOf(t);
              return (
                <div key={t.id} className="flex flex-col gap-1 p-4">
                  <div className="text-sm font-medium">{t.title} · <Link href={p.href} className="font-normal text-ink-dim underline-offset-2 hover:underline">{p.name}</Link></div>
                  <p className="text-sm text-amber-300">Date typed in without a photo{t.expiration_date ? `: good to ${fmtDate(t.expiration_date)}` : ""}. The feed shows who.</p>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {decided.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink-dim">Recent uploads</h2>
          <Card className="divide-y divide-line p-0">
            {decided.map((u) => {
              const l = label(u.item_id);
              const how = u.status === "rejected" ? `Turned down by ${u.reviewed_by_name ?? "a manager"}${u.review_note ? `: ${u.review_note}` : ""}`
                : u.reviewed_by_name ? `Approved by ${u.reviewed_by_name}`
                : "Passed the photo check";
              return (
                <div key={u.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-4 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{l.title}</span>
                    {l.parent ? <span className="text-ink-dim"> · {l.parent.name}</span> : null}
                    <div className={u.status === "rejected" ? "text-red-300" : "text-ink-dim"}>{how}</div>
                  </div>
                  <span className="text-xs text-ink-faint">{u.uploaded_by_name ?? "Someone"} · {fmtWhen(u.created_at)}</span>
                </div>
              );
            })}
          </Card>
        </section>
      )}
    </div>
  );
}
