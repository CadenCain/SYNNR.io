import { requireCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import type { Answer } from "@/lib/saas/brain";
import { answersOn } from "@/lib/saas/brain-ask";
import { SAMPLE_QUESTIONS } from "@/lib/saas/brain-samples";
import Ask, { type Before } from "./_synnr/ask";

// The layout's "%s · SYNNR" doesn't reach a page in its own folder.
export const metadata = { title: { absolute: "SYNNR" } };
export const dynamic = "force-dynamic";

/**
 * Home: ask the brain. One bar, what it has to answer from, and what's been
 * asked before. The database decides what this person sees: a hand's own
 * questions and the documents that aren't managers only; a manager's whole
 * shop.
 */
export default async function AskHome({ searchParams }: { searchParams: Promise<{ welcome?: string; joined?: string }> }) {
  const { company, user } = await requireCompany();
  const { welcome, joined } = await searchParams;
  const db = await saasDb();
  const [{ count: docs }, { count: lists }, { data: asked }] = await Promise.all([
    db.from("synnr_docs").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "ready"),
    db.from("saas_packages").select("id", { count: "exact", head: true }).eq("company_id", company.id).is("unit_id", null),
    db.from("synnr_asks").select("id, mode, question, answer, how, asked_by, user_id, created_at").eq("company_id", company.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const full = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  type Row = { id: string; mode: "ask" | "job"; question: string; answer: Answer; how: Answer["how"]; asked_by: string | null; user_id: string | null; created_at: string };
  const before: Before[] = ((asked ?? []) as Row[]).filter((r) => r.answer && Array.isArray(r.answer.parts)).map((r) => ({
    id: r.id, mode: r.mode, question: r.question, answer: r.answer, at: r.created_at, by: r.user_id === user.id ? null : r.asked_by,
  }));
  return (
    <Ask firstName={full.split(/\s+/)[0] ?? ""} companyName={company.name} manager={company.role !== "member"}
      writable={isWritable(company.subscription_status, company.comped)} demo={company.is_demo} written={answersOn()}
      docs={docs ?? 0} lists={lists ?? 0} before={before}
      examples={company.is_demo ? SAMPLE_QUESTIONS : ["What do we charge for standby?", "What does the MSA say about cancelling a job?", "What goes out on this kind of job?", "How do we rig up and test?"]}
      hello={welcome ? "welcome" : joined ? "joined" : null} />
  );
}
