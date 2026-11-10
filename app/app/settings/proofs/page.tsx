import { fmtDay } from "@/lib/saas/format";
import Link from "next/link";
import { Ban } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { revokeReadinessProof, setLoadoutLink } from "@/app/app/_proof-actions";
import { isManagerRole } from "@/lib/saas/yard-rules";
import { fmtWhen } from "@/lib/saas/format";

export const metadata = { title: "Proof links" };

export const dynamic = "force-dynamic";

export default async function ProofsSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const manager = isManagerRole(company.role);
  // The operator link the newest load-outs made, newest first, and which are
  // shut off. Older ones are shut off from the record itself (Load-out records).
  const RECENT = 60;
  const [{ data: loRows }, { data: offRows }] = await Promise.all([
    db.from("saas_loadout_scans").select("id, unit_name, finished_at, verdict, proof_token, scanned_by")
      .eq("company_id", company.id).order("finished_at", { ascending: false }).limit(RECENT),
    db.from("saas_loadout_link_offs").select("loadout_id").eq("company_id", company.id),
  ]);
  const offIds = new Set(((offRows ?? []) as { loadout_id: string }[]).map((r) => r.loadout_id));
  const loadouts = (loRows ?? []) as { id: string; unit_name: string; finished_at: string; verdict: string | null; proof_token: string; scanned_by: string | null }[];
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";

  const { data } = await db
    .from("saas_readiness_proofs")
    .select("id, token, scope, created_at, created_by, revoked_at, saas_yards(name), saas_units(name)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100);
  type Row = { id: string; token: string; scope: string; created_at: string; created_by: string | null; revoked_at: string | null; saas_yards: { name: string } | { name: string }[] | null; saas_units: { name: string } | { name: string }[] | null };
  const rows = (data ?? []) as Row[];
  // Who made each link, so a manager can find and shut off the ones made by
  // someone who's off the crew now. Names come from the sign-in accounts,
  // once per person, and only for people who made one of this company's links.
  const makerIds = [...new Set(rows.map((p) => p.created_by).filter((x): x is string => Boolean(x)))].slice(0, 50);
  const admin = makerIds.length ? saasAdmin() : null;
  const makers = new Map<string, { name: string; off: boolean }>();
  if (admin) {
    const { data: mem, error: memErr } = await admin.from("saas_memberships").select("user_id").eq("company_id", company.id).eq("status", "active").in("user_id", makerIds);
    // Couldn't read the crew: nobody gets called off it.
    const onCrew = memErr ? null : new Set(((mem ?? []) as { user_id: string }[]).map((m) => m.user_id));
    await Promise.all(makerIds.map(async (id) => {
      const { data: who } = await admin.auth.admin.getUserById(id);
      const name = (who?.user?.user_metadata?.full_name as string | undefined)?.trim() || who?.user?.email?.split("@")[0];
      if (name) makers.set(id, { name, off: Boolean(onCrew && !onCrew.has(id)) });
    }));
  }
  const madeBy = (id: string | null) => {
    const m = id ? makers.get(id) : undefined;
    return m ? `${m.name}${m.off ? " (off the crew)" : ""}` : null;
  };
  const proofs = rows.map((p) => ({
    ...p,
    madeBy: madeBy(p.created_by),
    scopeLabel:
      p.scope === "unit" ? `Truck: ${(Array.isArray(p.saas_units) ? p.saas_units[0]?.name : p.saas_units?.name) ?? ""}`
      : p.scope === "yard" ? `Yard: ${(Array.isArray(p.saas_yards) ? p.saas_yards[0]?.name : p.saas_yards?.name) ?? ""}`
      : "Whole company",
  }));

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: "/app/settings", label: "Settings" }}
        title="Proof links"
        description="The links you send operators. Shut one off and it stops working right away, and so do the certs and the truck photo on it."
      />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Load-out links</h2>
        <p className="-mt-1 text-[13px] text-ink-faint">
          Each load-out makes one for the operator: the iron, its certs, who loaded it, and the photo of the truck.
          {" "}These are the newest {RECENT}. For an older one, open it from <Link href="/app/loadouts" className="text-bone hover:underline">Load-out records</Link> and shut it off there.
        </p>
        <p className="-mt-1 text-[13px] text-ink-faint">Shutting off a link doesn&apos;t shut off the piece pages it opens. Those are the same page as the QR tag on the iron.</p>
        {loadouts.length === 0 ? <Card className="p-4 text-sm text-ink-dim">No load-outs yet.</Card> : loadouts.map((l) => {
          const off = offIds.has(l.id);
          return (
            <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 text-sm">
                <Link href={`/app/loadouts/${l.id}`} className="font-medium hover:text-bone">{l.unit_name}</Link>
                <span className="text-ink-dim"> · {fmtWhen(l.finished_at)}{l.scanned_by ? ` · ${l.scanned_by}` : ""} · {l.verdict === "ready" ? "READY" : "NOT READY"}</span>
                <div className="text-[13px]">{off ? <span className="text-ink-faint">Shut off</span> : <Link href={`/l/${l.proof_token}`} target="_blank" className="text-bone hover:underline">Open the link</Link>}</div>
              </div>
              {manager ? (
                <form action={setLoadoutLink}>
                  <input type="hidden" name="loadout_id" value={l.id} />
                  <input type="hidden" name="off" value={off ? "0" : "1"} />
                  <button type="submit" className={off ? "min-h-11 rounded-lg border border-line-2 px-3 text-sm text-ink hover:bg-elevated" : "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-500/40 px-3 text-sm text-red-400 hover:bg-red-500/10"}>
                    {off ? "Turn it back on" : <><Ban className="h-3.5 w-3.5" /> Shut off</>}
                  </button>
                </form>
              ) : null}
            </Card>
          );
        })}
      </section>
      <h2 className="-mb-4 text-sm font-semibold">Truck, yard, and company links</h2>

      {proofs.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No proof links yet. Make one with the Share proof button on the Trucks page, a yard, or a truck.
        </Card>
      ) : (
        <Table>
          <thead>
            <tr><Th>Scope</Th><Th className="hidden sm:table-cell">Created</Th><Th className="hidden sm:table-cell">Link</Th><Th className="text-right">Status</Th></tr>
          </thead>
          <tbody>
            {proofs.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium">
                  {p.scopeLabel}
                  <div className="text-xs font-normal text-ink-faint sm:hidden">
                    Made {fmtDay(p.created_at)}{p.madeBy ? ` by ${p.madeBy}` : ""}
                    {!p.revoked_at ? <> · <Link href={`/proof/${p.token}`} target="_blank" className="text-bone">open it</Link></> : null}
                  </div>
                </Td>
                <Td className="hidden text-ink-dim sm:table-cell">
                  <span className="tabular-nums">{fmtDay(p.created_at)}</span>
                  {p.madeBy ? <div className="text-xs text-ink-faint">Made by {p.madeBy}</div> : null}
                </Td>
                <Td className="hidden sm:table-cell">
                  {p.revoked_at ? <span className="text-ink-faint">Shut off</span> : (
                    <Link href={`/proof/${p.token}`} target="_blank" className="text-bone hover:underline">
                      {origin.replace(/^https?:\/\//, "")}/proof/{p.token.slice(0, 8)}…
                    </Link>
                  )}
                </Td>
                <Td className="text-right">
                  {p.revoked_at ? (
                    <span className="rounded-sm border border-line-2 bg-elevated px-2.5 py-0.5 text-xs text-ink-faint">Shut off</span>
                  ) : !manager ? null : (
                    <form action={revokeReadinessProof} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10">
                        <Ban className="h-3 w-3" /> Shut off
                      </button>
                    </form>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
