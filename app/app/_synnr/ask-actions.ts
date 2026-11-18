"use server";

import type { User } from "@supabase/supabase-js";
import { requireWritableCompany } from "@/lib/saas/auth";
import { saasAdmin, saasDb } from "@/lib/saas/db";
import type { Answer } from "@/lib/saas/brain";
import { answersOn, findSources, otherWords, writeAnswer, NOT_FOUND, type Found } from "@/lib/saas/brain-ask";

/**
 * Ask the brain. The passages are found as the person asking (so the
 * database decides what they may see), the answer is written from those
 * passages only, and the question and what came back are kept. When the
 * shop's documents have nothing on it, the answer says so and the AI is
 * never asked: there is nothing for it to answer from.
 */

const nameOf = (u: User) => (u.user_metadata?.full_name as string | undefined)?.trim() || u.email?.split("@")[0] || "Someone";

/** A question is a line or two. A job pasted from dispatch is longer. */
const MAX_ASK = 1500;
const MAX_JOB = 6000;
/** The demo is open to anyone: each demo company answers this many questions, and all of them together get this many written answers a day. */
const DEMO_ASKS = 40;
const DEMO_WRITTEN_A_DAY = 300;
/** A real shop's written answers in a day. Far more than a crew asks; it stops a runaway script. */
const WRITTEN_A_DAY = 600;

export type Asked = { ok: true; id: string | null; answer: Answer } | { ok: false; error: string };

export async function ask(input: { question: string; mode?: "ask" | "job" }): Promise<Asked> {
  const got = await requireWritableCompany();
  if (!got.ok) return { ok: false, error: got.error };
  const { company, user } = got;
  const mode = input.mode === "job" ? "job" : "ask";
  const question = String(input.question ?? "").trim();
  if (!question) return { ok: false, error: mode === "job" ? "Paste the job in first." : "Ask it something." };
  if (question.length > (mode === "job" ? MAX_JOB : MAX_ASK)) {
    return { ok: false, error: mode === "job" ? "That's too long to read in one go. Paste the part that describes the job." : "That's a long one. Ask it in a sentence or two." };
  }

  const admin = saasAdmin();
  const dayAgo = new Date(Date.now() - 86400e3).toISOString();
  if (company.is_demo && admin) {
    const { count } = await admin.from("synnr_asks").select("id", { count: "exact", head: true }).eq("company_id", company.id);
    if ((count ?? 0) >= DEMO_ASKS) return { ok: false, error: `The demo answers ${DEMO_ASKS} questions. Request access and it's your own documents it answers from.` };
  }

  // The written answer is on, and today's limit has room for one more.
  const write = answersOn() && (await underTheCap(company.id, company.is_demo, dayAgo));

  // Read as the person asking: the database decides which passages are theirs to see.
  const db = await saasDb();
  let found: Found;
  try {
    found = await findSources(db, company.id, question, write && mode === "ask" ? await otherWords(question) : "", mode);
  } catch (e) {
    console.error("[ask] search:", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't go through. Try again." };
  }
  const { sources } = found;
  const shown = sources.slice(0, found.show);
  const stretch = "No passage has everything you asked about. These are the closest.";

  let answer: Answer;
  if (!sources.length) {
    const { count } = await db.from("synnr_docs").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "ready");
    answer = {
      how: "none", sources: [],
      parts: [{ cites: [], text: (count ?? 0) === 0
        ? "There's nothing in the brain yet, so there's nothing to answer from."
        : "Nothing in your documents about that. I won't guess." }],
    };
  } else {
    answer = { how: "passages", parts: [], sources: shown, note: found.weak ? stretch : null };
    if (write) {
      try {
        const parts = await writeAnswer({ company: company.name, mode, question, sources });
        const text = parts.map((p) => p.text).join("").trim();
        if (text.startsWith(NOT_FOUND)) {
          // It read the closest passages and they don't hold the answer.
          answer = { how: "none", parts: [{ text, cites: [] }], sources: shown, note: "The closest passages are below, in case one of them is what you meant." };
        } else {
          const used = new Set(parts.flatMap((p) => p.cites));
          answer = {
            how: "ai", parts,
            // What it pointed to, then the other passages it was given that were close.
            sources: [...sources.filter((s) => used.has(s.n)), ...shown.filter((s) => !used.has(s.n))],
            note: used.size ? null : "SYNNR didn't tie this to a passage. Check it against the passages below before you rely on it.",
          };
        }
      } catch (e) {
        console.error("[ask] answer:", e instanceof Error ? e.message : e);
        answer.note = "The written answer didn't come back, so here are the passages themselves.";
      }
    }
  }

  // Kept as it was shown, so it reads the same later whatever happens to the documents.
  let id: string | null = null;
  if (admin) {
    const { data, error } = await admin.from("synnr_asks").insert({
      company_id: company.id, user_id: user.id, asked_by: nameOf(user).slice(0, 120), mode, question, how: answer.how,
      answer: { ...answer, sources: answer.sources.map((s) => ({ ...s, body: s.body.slice(0, 2400) })) },
    }).select("id").single();
    if (error) console.error("[ask] keep:", error.message);
    id = (data as { id: string } | null)?.id ?? null;
  }
  return { ok: true, id, answer };
}

/** Whether another written answer is within the day's limit. Counted by the server, so it can't be talked around. */
async function underTheCap(companyId: string, demo: boolean, since: string): Promise<boolean> {
  const admin = saasAdmin();
  if (!admin) return true;
  if (demo) {
    const { count } = await admin.from("synnr_asks").select("id, saas_companies!inner(is_demo)", { count: "exact", head: true })
      .eq("how", "ai").eq("saas_companies.is_demo", true).gte("created_at", since);
    return (count ?? 0) < DEMO_WRITTEN_A_DAY;
  }
  const { count } = await admin.from("synnr_asks").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("how", "ai").gte("created_at", since);
  return (count ?? 0) < WRITTEN_A_DAY;
}
