import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Links to the paper behind each test's current date, for "See the cert":
 * the photo or scan the server read. A demo yard's tests carry a sample cert
 * drawn for that exact piece (app/demo-cert), so their storage path is a
 * stand-in, not a file.
 */
export const DEMO_PAPER = "demo-cert:";

type Upload = { id: string; item_id: string; storage_path: string };

/** Upload id → link. Signed links last an hour. */
async function signPaper(client: SupabaseClient, ups: Upload[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const u of ups) if (u.storage_path.startsWith(DEMO_PAPER)) out.set(u.id, `/demo-cert/${u.item_id}`);
  const real = ups.filter((u) => !u.storage_path.startsWith(DEMO_PAPER));
  if (real.length) {
    const { data: signed } = await client.storage.from("proofs").createSignedUrls(real.map((u) => u.storage_path), 3600);
    real.forEach((u, i) => { const url = signed?.[i]?.signedUrl; if (url) out.set(u.id, url); });
  }
  return out;
}

async function uploadsById(client: SupabaseClient, ids: string[]): Promise<Upload[]> {
  if (!ids.length) return [];
  const { data } = await client.from("saas_cert_uploads").select("id, item_id, storage_path").in("id", [...new Set(ids)].slice(0, 500));
  return (data ?? []) as Upload[];
}

/** Item id → link, for items' current papers. On a session client, RLS keeps it inside the company. */
export async function paperLinks(client: SupabaseClient, items: { id: string; last_upload_id?: string | null }[]): Promise<Map<string, string>> {
  const ups = await uploadsById(client, items.map((i) => i.last_upload_id).filter((x): x is string => Boolean(x)));
  const byUpload = await signPaper(client, ups);
  return new Map(ups.filter((u) => byUpload.has(u.id)).map((u) => [u.item_id, byUpload.get(u.id)!]));
}

/**
 * The paper behind every piece on a load-out record, for the operator: the
 * cert each test stood on when the truck loaded (kept on the record), or the
 * piece's current cert for records saved before that was kept.
 */
export async function recordPaper(
  client: SupabaseClient,
  companyId: string,
  pieces: { asset_id: string; tests?: { title: string; paper?: string | null }[] }[],
): Promise<Record<string, { title: string; url: string }[]>> {
  const want: { asset: string; title: string; upload: string }[] = [];
  const noSnapshot: string[] = [];
  for (const p of pieces) {
    const kept = (p.tests ?? []).filter((t) => t.paper);
    if (kept.length) for (const t of kept) want.push({ asset: p.asset_id, title: t.title, upload: t.paper! });
    else noSnapshot.push(p.asset_id);
  }
  if (noSnapshot.length) {
    const { data } = await client.from("saas_compliance_items").select("title, parent_id, last_upload_id")
      .eq("company_id", companyId).eq("parent_type", "asset").in("parent_id", noSnapshot.slice(0, 300)).not("last_upload_id", "is", null);
    for (const r of (data ?? []) as { title: string; parent_id: string; last_upload_id: string }[]) want.push({ asset: r.parent_id, title: r.title, upload: r.last_upload_id });
  }
  const byUpload = await signPaper(client, await uploadsById(client, want.map((w) => w.upload)));
  const out: Record<string, { title: string; url: string }[]> = {};
  for (const w of want) {
    const url = byUpload.get(w.upload);
    if (url) (out[w.asset] ??= []).push({ title: w.title, url });
  }
  return out;
}
