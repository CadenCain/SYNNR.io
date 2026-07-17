import Link from "next/link";
import { Ban } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { revokeReadinessProof } from "@/app/app/_proof-actions";

export const dynamic = "force-dynamic";

export default async function ProofsSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";

  const { data } = await db
    .from("saas_readiness_proofs")
    .select("id, token, scope, created_at, revoked_at, saas_yards(name), saas_units(name)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100);
  type Row = { id: string; token: string; scope: string; created_at: string; revoked_at: string | null; saas_yards: { name: string } | { name: string }[] | null; saas_units: { name: string } | { name: string }[] | null };
  const proofs = ((data ?? []) as Row[]).map((p) => ({
    ...p,
    scopeLabel:
      p.scope === "unit" ? `Unit — ${(Array.isArray(p.saas_units) ? p.saas_units[0]?.name : p.saas_units?.name) ?? ""}`
      : p.scope === "yard" ? `Yard — ${(Array.isArray(p.saas_yards) ? p.saas_yards[0]?.name : p.saas_yards?.name) ?? ""}`
      : "Whole company",
  }));

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: "/app/settings", label: "Settings" }}
        title="Readiness proofs"
        description="Every share link you've created. Revoke anything you don't want out there — dead links show 'revoked'."
      />

      {proofs.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No proof links yet. Create one from the Dashboard, a yard, or a unit — &ldquo;Share readiness proof.&rdquo;
        </Card>
      ) : (
        <Table>
          <thead>
            <tr><Th>Scope</Th><Th>Created</Th><Th>Link</Th><Th className="text-right">Status</Th></tr>
          </thead>
          <tbody>
            {proofs.map((p) => (
              <Tr key={p.id}>
                <Td className="font-medium">{p.scopeLabel}</Td>
                <Td className="tabular-nums text-ink-dim">{new Date(p.created_at).toLocaleDateString()}</Td>
                <Td>
                  {p.revoked_at ? <span className="text-ink-faint">—</span> : (
                    <Link href={`/proof/${p.token}`} target="_blank" className="text-bone hover:underline">
                      {origin.replace(/^https?:\/\//, "")}/proof/{p.token.slice(0, 8)}…
                    </Link>
                  )}
                </Td>
                <Td className="text-right">
                  {p.revoked_at ? (
                    <span className="rounded-sm border border-line-2 bg-elevated px-2.5 py-0.5 text-xs text-ink-faint">Revoked</span>
                  ) : (
                    <form action={revokeReadinessProof} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/10">
                        <Ban className="h-3 w-3" /> Revoke
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
