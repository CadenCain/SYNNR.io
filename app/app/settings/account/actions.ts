"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";

type Result = { ok: boolean; message: string };

/** Your name, as it goes on every scan, check-in, and override from now on. */
export async function saveName(_prev: Result | null, fd: FormData): Promise<Result> {
  const { company, user } = await requireCompany();
  const name = String(fd.get("full_name") ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return { ok: false, message: "Type your first and last name." };
  const sb = await saasDb();
  if (!sb) return { ok: false, message: "Couldn't save it. Try again." };
  const before = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "someone";
  const { error } = await sb.auth.updateUser({ data: { full_name: name } });
  if (error) return { ok: false, message: "Couldn't save it. Try again." };
  if (before !== name) void logEvent({ companyId: company.id, kind: "crew_changed", actor: name, message: `${before} now goes by ${name}` });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved. Your new name goes on everything from now on; older records keep the name they were saved with." };
}

/** A new password, for someone who's signed in. */
export async function savePassword(_prev: Result | null, fd: FormData): Promise<Result> {
  await requireCompany();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { ok: false, message: "At least 8 characters." };
  const sb = await saasDb();
  if (!sb) return { ok: false, message: "Couldn't save it. Try again." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) {
    return { ok: false, message: /different from the old/i.test(error.message) ? "Pick a password you haven't used here before."
      : /reauthenticat|recent/i.test(error.message) ? "For safety, log out and back in, then change it." : "Couldn't change it. Try again." };
  }
  return { ok: true, message: "Password changed." };
}

/** The company name, as it shows on proof links and emails. Managers only. */
export async function saveCompanyName(_prev: Result | null, fd: FormData): Promise<Result> {
  const { company, user } = await requireCompany();
  assertCan(company, "rename_company");
  // The demo yard keeps its made-up name: its proof links are public.
  if (company.is_demo) return { ok: false, message: "The demo yard's name can't be changed." };
  const name = String(fd.get("company_name") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (name.length < 2) return { ok: false, message: "Type the company name." };
  const db = await saasDb();
  const { error } = await db.from("saas_companies").update({ name }).eq("id", company.id);
  if (error) return { ok: false, message: "Couldn't save it. Try again." };
  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "A manager";
  if (name !== company.name) void logEvent({ companyId: company.id, kind: "crew_changed", actor, message: `${actor} renamed the company from ${company.name} to ${name}` });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved." };
}
