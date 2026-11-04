"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/** The cookie that remembers which truck a hand is on, on this phone. */
export const myTruckCookie = async (companyId: string) => `rr_truck_${companyId.slice(0, 8)}`;

/** "That's my truck": this phone remembers it, and the board puts it first. */
export async function pickMyTruck(fd: FormData): Promise<void> {
  const { company } = await requireCompany();
  const unitId = String(fd.get("unit_id") ?? "");
  const db = await saasDb();
  const { data } = await db.from("saas_units").select("id").eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (data) (await cookies()).set(await myTruckCookie(company.id), unitId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect("/app");
}
