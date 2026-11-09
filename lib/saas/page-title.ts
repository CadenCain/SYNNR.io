import type { Metadata } from "next";
import { saasDb } from "./db";

type Named = "saas_units" | "saas_assets" | "saas_yards" | "saas_packages";

/**
 * A browser tab title with the thing's name in it ("Load-out: CT-01"), so a
 * manager with six tabs open can tell them apart. Read through the signed-in
 * session, so it only ever names what that person can see; anything else
 * falls back to the plain title.
 */
export async function titled(table: Named, id: string, make: (name: string) => string, fallback: string): Promise<Metadata> {
  try {
    const db = await saasDb();
    const { data } = await db.from(table).select("name").eq("id", id).maybeSingle();
    const name = (data as { name?: string } | null)?.name?.trim();
    return { title: name ? make(name) : fallback };
  } catch {
    return { title: fallback };
  }
}
