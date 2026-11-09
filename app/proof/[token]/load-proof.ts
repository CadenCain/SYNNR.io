import type { SupabaseClient } from "@supabase/supabase-js";

export type Proof = { id: string; company_id: string; yard_id: string | null; unit_id: string | null; scope: string; expires_at: string | null; revoked_at: string | null; created_at: string };

/** A truck, yard, or company proof link, if it's still good; otherwise why not. */
export async function loadProof(admin: SupabaseClient, token: string): Promise<Proof | "not valid" | "revoked" | "expired"> {
  const { data } = await admin
    .from("saas_readiness_proofs")
    .select("id, company_id, yard_id, unit_id, scope, expires_at, revoked_at, created_at")
    .eq("token", token).maybeSingle();
  if (!data) return "not valid";
  const proof = data as Proof;
  if (proof.revoked_at) return "revoked";
  if (proof.expires_at && new Date(proof.expires_at) < new Date()) return "expired";
  return proof;
}

/**
 * Is this test one the proof link shows? The same scope as the page: a truck
 * link shows its truck's paper and the iron on it, a yard link its trucks
 * and its iron, a company link everything but the crew. Retired iron is off
 * every proof.
 */
export async function itemInProofScope(
  admin: SupabaseClient,
  proof: Pick<Proof, "company_id" | "scope" | "yard_id" | "unit_id">,
  item: { parent_type: string; parent_id: string },
): Promise<boolean> {
  if (item.parent_type === "crew") return false;
  const unitYard = async (unitId: string) => {
    const { data } = await admin.from("saas_units").select("yard_id").eq("id", unitId).eq("company_id", proof.company_id).maybeSingle();
    return data ? ((data as { yard_id: string | null }).yard_id ?? null) : undefined;
  };
  if (item.parent_type === "unit") {
    if (proof.scope === "unit") return Boolean(proof.unit_id) && item.parent_id === proof.unit_id;
    const yard = await unitYard(item.parent_id);
    if (yard === undefined) return false;
    return proof.scope === "yard" ? Boolean(proof.yard_id) && yard === proof.yard_id : true;
  }
  if (item.parent_type === "asset") {
    const { data } = await admin.from("saas_assets").select("unit_id, yard_id, status").eq("id", item.parent_id).eq("company_id", proof.company_id).maybeSingle();
    const a = data as { unit_id: string | null; yard_id: string | null; status: string } | null;
    if (!a || a.status === "retired") return false;
    if (proof.scope === "unit") return Boolean(proof.unit_id) && a.unit_id === proof.unit_id;
    if (proof.scope === "yard") {
      if (!proof.yard_id) return false;
      if (a.yard_id === proof.yard_id) return true;
      return Boolean(a.unit_id) && (await unitYard(a.unit_id!)) === proof.yard_id;
    }
    return true;
  }
  // Anything else hangs off the company itself: only a company link shows it.
  return proof.scope !== "unit" && proof.scope !== "yard";
}
