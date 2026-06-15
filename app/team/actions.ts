"use server";

import { revalidatePath } from "next/cache";
import { getSignedInOrg } from "@/lib/marketplace/access";
import { getAdminSupabase } from "@/lib/supabase/admin";

type ActionResult = { ok?: true; error?: string };

/**
 * Resolve the caller + admin client + their role in the active org. Self-heals
 * legacy users (workspace but no membership row) into an owner membership so
 * the team model works for existing accounts. Membership writes go through the
 * service-role client (memberships has SELECT-only RLS by design).
 */
async function ctx() {
  const org = await getSignedInOrg();
  if (!org?.workspaceId) return { error: "Not signed in." as const };
  const admin = getAdminSupabase();
  if (!admin) return { error: "Team management isn't available yet (service role key not set)." as const };

  const { data: m } = await admin
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("workspace_id", org.workspaceId)
    .maybeSingle();

  let role = m?.role;
  if (!role) {
    await admin.from("memberships").insert({ user_id: org.userId, workspace_id: org.workspaceId, role: "owner" });
    role = "owner";
  }
  return { org, admin, role, workspaceId: org.workspaceId };
}

const canManage = (role: string) => role === "owner" || role === "admin";
const validRole = (r: string) => (["owner", "admin", "member"].includes(r) ? r : "member");

export async function inviteMember(formData: FormData): Promise<ActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  if (!canManage(c.role)) return { error: "Only owners and admins can invite." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/\S+@\S+\.\S+/.test(email)) return { error: "Enter a valid email." };
  const role = validRole(String(formData.get("role") || "member"));

  const { error } = await c.admin.from("invites").insert({ workspace_id: c.workspaceId, email, role });
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

export async function revokeInvite(formData: FormData): Promise<ActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  if (!canManage(c.role)) return { error: "Only owners and admins can manage invites." };

  const id = String(formData.get("id") || "");
  const { error } = await c.admin.from("invites").update({ status: "revoked" }).eq("id", id).eq("workspace_id", c.workspaceId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

export async function assignSeat(formData: FormData): Promise<ActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  if (!canManage(c.role)) return { error: "Only owners and admins can assign seats." };

  const product = String(formData.get("product") || "");
  const userId = String(formData.get("user_id") || "");
  if (!product || !userId) return { error: "Missing product or user." };

  // enforce the seat cap from the subscription
  const { data: sub } = await c.admin
    .from("subscriptions")
    .select("seats, status")
    .eq("workspace_id", c.workspaceId)
    .eq("product_slug", product)
    .maybeSingle();
  if (!sub || !["active", "trialing"].includes(sub.status ?? "")) return { error: "No active subscription for that app." };

  const { count } = await c.admin
    .from("seat_assignments")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", c.workspaceId)
    .eq("product_slug", product);
  if ((count ?? 0) >= (sub.seats ?? 0)) return { error: "All seats are assigned. Add seats in Billing first." };

  const { error } = await c.admin
    .from("seat_assignments")
    .upsert({ workspace_id: c.workspaceId, product_slug: product, user_id: userId }, { onConflict: "workspace_id,product_slug,user_id" });
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

export async function revokeSeat(formData: FormData): Promise<ActionResult> {
  const c = await ctx();
  if ("error" in c) return { error: c.error };
  if (!canManage(c.role)) return { error: "Only owners and admins can change seats." };

  const product = String(formData.get("product") || "");
  const userId = String(formData.get("user_id") || "");
  const { error } = await c.admin
    .from("seat_assignments")
    .delete()
    .eq("workspace_id", c.workspaceId)
    .eq("product_slug", product)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  revalidatePath("/team");
  return { ok: true };
}

// void-returning wrappers for direct <form action={...}> usage in server components
export async function revokeInviteForm(formData: FormData): Promise<void> { await revokeInvite(formData); }
export async function assignSeatForm(formData: FormData): Promise<void> { await assignSeat(formData); }
export async function revokeSeatForm(formData: FormData): Promise<void> { await revokeSeat(formData); }
