"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";

/**
 * Setting tools a vendor keeps the yard stocked with, by count (see
 * migration 0033). Every write goes through a database function that locks
 * the count, so two phones can't both take the last one, and a resend after
 * a dropped signal (same key) doesn't take two.
 */

type R = { ok: boolean; error?: string; summary?: string };

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";
const isManager = (role: string) => role === "owner" || role === "admin";
const keyOf = (k: unknown) => (typeof k === "string" && /^[A-Za-z0-9-]{8,64}$/.test(k) ? k : null);
const intIn = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
/** "Silver Fox setting tool" -> "Silver Fox setting tools" when there's more than one. */
const many = (n: number, name: string) => `${n} ${name}${n === 1 || /s$/i.test(name) ? "" : "s"}`;
/** The database's own words for a refusal ("Only 1 ready on the shelf."), not its plumbing. */
const why = (e: { message?: string; code?: string } | null, fallback: string) =>
  e?.code === "P0001" || e?.code === "P0002" || e?.code === "22023" ? e.message ?? fallback : fallback;

function refresh() {
  revalidatePath("/app/signout");
  revalidatePath("/app");
}

async function stockFor(companyId: string, stockId: unknown) {
  const admin = saasAdmin();
  if (!admin || typeof stockId !== "string") return { admin, stock: null };
  const { data } = await admin.from("saas_tool_stocks").select("id, name, vendor, yard_id, ready, used")
    .eq("company_id", companyId).eq("id", stockId).is("archived_at", null).maybeSingle();
  return { admin, stock: data as { id: string; name: string; vendor: string | null; yard_id: string; ready: number; used: number } | null };
}

/** A manager starts counting a yard's setting tools: what they're called, whose they are, how many are on the shelf. */
export async function addToolStock(input: { yardId: string; name: string; vendor?: string; ready: number; used?: number; lowAt?: number }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  if (!isManager(company.role)) return { ok: false, error: "Only a manager can set this up." };
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Try again in a minute." };
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "Say what they're called, like Silver Fox setting tool." };
  const ready = intIn(input.ready, 0, 999), used = intIn(input.used ?? 0, 0, 999), lowAt = intIn(input.lowAt ?? 2, 0, 99);
  if (ready === null || used === null || lowAt === null) return { ok: false, error: "Counts go from 0 to 999." };
  const db = await saasDb();
  const { data: yard } = await db.from("saas_yards").select("id, name").eq("company_id", company.id).eq("id", String(input.yardId ?? "")).maybeSingle();
  if (!yard) return { ok: false, error: "Pick one of your yards." };
  const { data: row, error } = await admin.from("saas_tool_stocks").insert({
    company_id: company.id, yard_id: (yard as { id: string }).id, name, vendor: clean(input.vendor, 80) || null, ready, used, low_at: lowAt,
  }).select("id").single();
  if (error?.code === "23505") return { ok: false, error: `${(yard as { name: string }).name} already counts ${name}.` };
  if (error || !row) return { ok: false, error: `Couldn't save it: ${error?.message ?? "unknown"}` };
  const actor = actorOf(user);
  await admin.from("saas_tool_stock_log").insert({
    company_id: company.id, stock_id: (row as { id: string }).id, kind: "added", ready_delta: ready, used_delta: used,
    note: `Started counting: ${ready} ready, ${used} used`, by_name: actor, by_user: user.id,
  });
  void logEvent({ companyId: company.id, kind: "tool_count", actor, message: `${actor} started counting ${name} at ${(yard as { name: string }).name}: ${ready} ready` });
  refresh();
  return { ok: true, summary: `Counting ${name} at ${(yard as { name: string }).name}.` };
}

/** A manager renames it, changes the vendor, or when to warn. */
export async function editToolStock(input: { stockId: string; name: string; vendor?: string; lowAt: number }): Promise<R> {
  const { company } = await requireBillableCompany();
  if (!isManager(company.role)) return { ok: false, error: "Only a manager can change this." };
  const { admin, stock } = await stockFor(company.id, input.stockId);
  if (!admin || !stock) return { ok: false, error: "That list is gone. Reload the page." };
  const name = clean(input.name, 80);
  const lowAt = intIn(input.lowAt, 0, 99);
  if (!name || lowAt === null) return { ok: false, error: "Give it a name, and warn at 0 to 99." };
  const { error } = await admin.from("saas_tool_stocks").update({ name, vendor: clean(input.vendor, 80) || null, low_at: lowAt })
    .eq("company_id", company.id).eq("id", stock.id);
  if (error?.code === "23505") return { ok: false, error: `That yard already counts ${name}.` };
  if (error) return { ok: false, error: `Couldn't save it: ${error.message}` };
  refresh();
  return { ok: true, summary: "Saved." };
}

/** A manager stops counting a yard's setting tools (the history stays). Not while any are out. */
export async function stopToolStock(input: { stockId: string }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  if (!isManager(company.role)) return { ok: false, error: "Only a manager can change this." };
  const { admin, stock } = await stockFor(company.id, input.stockId);
  if (!admin || !stock) return { ok: false, error: "That list is gone. Reload the page." };
  const { count } = await admin.from("saas_tool_outs").select("id", { count: "exact", head: true })
    .eq("company_id", company.id).eq("stock_id", stock.id).is("back_at", null);
  if (count) return { ok: false, error: "Some are still out. Bring those back first." };
  await admin.from("saas_tool_stocks").update({ archived_at: new Date().toISOString() }).eq("company_id", company.id).eq("id", stock.id);
  const actor = actorOf(user);
  void logEvent({ companyId: company.id, kind: "tool_count", actor, message: `${actor} stopped counting ${stock.name}` });
  refresh();
  return { ok: true, summary: `Stopped counting ${stock.name}.` };
}

/** Take setting tools off the shelf: out under your name (or, a manager at the counter, someone on the crew's). */
export async function takeSettingTools(input: { stockId: string; qty: number; to?: string; note?: string; key?: string }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  const { admin, stock } = await stockFor(company.id, input.stockId);
  if (!admin || !stock) return { ok: false, error: "That list is gone. Reload the page." };
  const qty = intIn(input.qty, 1, 20);
  if (qty === null) return { ok: false, error: "Take between 1 and 20." };
  const actor = actorOf(user);
  let toId = user.id, toName = actor;
  if (input.to && input.to !== user.id) {
    if (!isManager(company.role)) return { ok: false, error: "Only a manager can sign them out to someone else." };
    const { data: m } = await admin.from("saas_memberships").select("user_id").eq("company_id", company.id).eq("user_id", input.to).eq("status", "active").maybeSingle();
    if (!m) return { ok: false, error: "That person isn't on the crew." };
    const { data: who } = await admin.auth.admin.getUserById(input.to);
    toId = input.to;
    toName = (who?.user?.user_metadata?.full_name as string | undefined)?.trim() || who?.user?.email?.split("@")[0] || "someone";
  }
  const note = clean(input.note, 120) || null;
  const { error } = await admin.rpc("saas_tool_take", {
    p_company: company.id, p_stock: stock.id, p_qty: qty, p_user: toId, p_name: toName,
    p_note: note, p_by: actor, p_by_user: user.id, p_key: keyOf(input.key),
  });
  if (error) return { ok: false, error: why(error, "Couldn't sign them out. Try again.") };
  const summary = toId === user.id
    ? `${actor} took ${many(qty, stock.name)}${note ? ` for ${note}` : ""}`
    : `${actor} signed out ${many(qty, stock.name)} to ${toName}${note ? ` for ${note}` : ""}`;
  void logEvent({ companyId: company.id, kind: "signed_out", actor, message: summary });
  refresh();
  return { ok: true, summary: `${many(qty, stock.name)} out to ${toId === user.id ? "you" : toName}.` };
}

/** Back from the job: how many ran (used pile) and how many didn't (back on the shelf). */
export async function bringBackSettingTools(input: { outId: string; used: number; unused: number }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Try again in a minute." };
  const { data } = await admin.from("saas_tool_outs").select("id, stock_id, out_user, out_name, qty, back_at")
    .eq("company_id", company.id).eq("id", String(input.outId ?? "")).maybeSingle();
  const o = data as { id: string; stock_id: string; out_user: string | null; out_name: string; qty: number; back_at: string | null } | null;
  if (!o) return { ok: false, error: "That line is gone. Reload the page." };
  if (o.back_at) return { ok: true, summary: "Already back." };
  if (o.out_user !== user.id && !isManager(company.role)) return { ok: false, error: `Only ${o.out_name} or a manager can bring these back.` };
  const used = intIn(input.used, 0, 20), unused = intIn(input.unused, 0, 20);
  if (used === null || unused === null || used + unused !== o.qty) return { ok: false, error: `Say how many of the ${o.qty} ran.` };
  const { data: s } = await admin.from("saas_tool_stocks").select("name").eq("id", o.stock_id).maybeSingle();
  const name = (s as { name: string } | null)?.name ?? "setting tool";
  const actor = actorOf(user);
  const { data: did, error } = await admin.rpc("saas_tool_back", { p_company: company.id, p_out: o.id, p_used: used, p_unused: unused, p_by: actor, p_by_user: user.id });
  if (error) return { ok: false, error: why(error, "Couldn't save that. Try again.") };
  if (did === false) return { ok: true, summary: "Already back." };
  const parts = [used ? `${used} ran (used pile)` : "", unused ? `${unused} didn't run (back on the shelf)` : ""].filter(Boolean).join(", ");
  void logEvent({ companyId: company.id, kind: "tools_back", actor, message: `${many(o.qty, name)} back from ${o.out_name}: ${parts}` });
  refresh();
  return { ok: true, summary: `Back: ${parts}.` };
}

/** The vendor came by: picked up the used ones, dropped off ready ones. */
export async function vendorVisit(input: { stockId: string; picked: number; dropped: number; key?: string }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  const { admin, stock } = await stockFor(company.id, input.stockId);
  if (!admin || !stock) return { ok: false, error: "That list is gone. Reload the page." };
  const picked = intIn(input.picked, 0, 999), dropped = intIn(input.dropped, 0, 999);
  if (picked === null || dropped === null || picked + dropped === 0) return { ok: false, error: "Say how many they picked up and how many they dropped off." };
  const actor = actorOf(user);
  const { data: did, error } = await admin.rpc("saas_tool_vendor", { p_company: company.id, p_stock: stock.id, p_picked: picked, p_dropped: dropped, p_by: actor, p_by_user: user.id, p_key: keyOf(input.key) });
  if (error) return { ok: false, error: why(error, "Couldn't save that. Try again.") };
  if (did === false) return { ok: true, summary: "Already saved." };
  const who = stock.vendor || "The vendor";
  void logEvent({ companyId: company.id, kind: "vendor_visit", actor, message: `${who} picked up ${many(picked, `used ${stock.name}`)} and dropped off ${dropped} ready (logged by ${actor})` });
  refresh();
  return { ok: true, summary: `Saved: ${picked} picked up, ${dropped} dropped off.` };
}

/** A manager counted the shelf and the used pile: the app takes what they saw. */
export async function countToolStock(input: { stockId: string; ready: number; used: number; key?: string }): Promise<R> {
  const { company, user } = await requireBillableCompany();
  if (!isManager(company.role)) return { ok: false, error: "Only a manager can change the count." };
  const { admin, stock } = await stockFor(company.id, input.stockId);
  if (!admin || !stock) return { ok: false, error: "That list is gone. Reload the page." };
  const ready = intIn(input.ready, 0, 999), used = intIn(input.used, 0, 999);
  if (ready === null || used === null) return { ok: false, error: "Counts go from 0 to 999." };
  const actor = actorOf(user);
  const { data: did, error } = await admin.rpc("saas_tool_count", { p_company: company.id, p_stock: stock.id, p_ready: ready, p_used: used, p_by: actor, p_by_user: user.id, p_key: keyOf(input.key) });
  if (error) return { ok: false, error: why(error, "Couldn't save that. Try again.") };
  if (did === false) return { ok: true, summary: "Already saved." };
  if (ready !== stock.ready || used !== stock.used) {
    void logEvent({ companyId: company.id, kind: "tool_count", actor,
      message: `${actor} counted ${stock.name}: ${ready} ready (app had ${stock.ready}), ${used} used (app had ${stock.used})` });
  }
  refresh();
  return { ok: true, summary: "Count saved." };
}
