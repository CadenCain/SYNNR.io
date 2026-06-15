import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Ensure a signed-in user has a "home" org: a personal workspace, their profile
 * pointing at it, and an owner membership. Idempotent and best-effort — if the
 * service-role key isn't set it no-ops (the onboarding RPC still creates one).
 *
 * Everything in the marketplace is an Organization; an individual operator is a
 * personal org with one member. Running this on every sign-in means the
 * buy-direct path (which skips onboarding) still works.
 */
export async function ensurePersonalOrg(userId: string, email: string | null): Promise<string | null> {
  const admin = getAdminSupabase();
  if (!admin) return null;

  const { data: profile } = await admin.from("profiles").select("workspace_id").eq("id", userId).maybeSingle();
  let workspaceId = profile?.workspace_id ?? null;

  if (!workspaceId) {
    const name = email ? `${email.split("@")[0]}'s workspace` : "Personal workspace";
    const { data: ws, error } = await admin
      .from("workspaces")
      .insert({ name, type: "personal" })
      .select("id")
      .single();
    if (error || !ws) return null;
    workspaceId = ws.id;
    await admin.from("profiles").upsert({ id: userId, email, workspace_id: workspaceId, role: "owner" }, { onConflict: "id" });
  }

  // ensure the owner membership exists either way
  await admin
    .from("memberships")
    .upsert({ user_id: userId, workspace_id: workspaceId, role: "owner" }, { onConflict: "user_id,workspace_id" });

  return workspaceId;
}
