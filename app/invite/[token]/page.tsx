import "../../marketing.css";
import "../../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg } from "@/lib/marketplace/access";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { SiteNav } from "../../site-chrome";

export const metadata = { title: "Join a team — SYNNR" };

/**
 * Accept a team invite. Requires sign-in (so we have a user to attach the
 * membership to). On accept: create the membership, mark the invite accepted,
 * and switch the user's active workspace to the inviting org.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getAdminSupabase();

  const org = await getSignedInOrg();
  if (!org) redirect(`/login?next=/invite/${token}`);

  let state: "ok" | "invalid" | "unavailable" = "ok";
  let orgName = "";

  if (!admin) {
    state = "unavailable";
  } else {
    const { data: invite } = await admin
      .from("invites")
      .select("id, workspace_id, role, status")
      .eq("token", token)
      .maybeSingle();

    if (!invite || invite.status !== "pending") {
      state = "invalid";
    } else {
      await admin.from("memberships").upsert(
        { user_id: org.userId, workspace_id: invite.workspace_id, role: invite.role },
        { onConflict: "user_id,workspace_id" }
      );
      await admin.from("invites").update({ status: "accepted" }).eq("id", invite.id);
      // switch the user's active workspace to the org they just joined
      await admin.from("profiles").update({ workspace_id: invite.workspace_id }).eq("id", org.userId);
      const { data: ws } = await admin.from("workspaces").select("name").eq("id", invite.workspace_id).maybeSingle();
      orgName = ws?.name ?? "the team";
    }
  }

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="appcard" style={{ maxWidth: 520 }}>
          {state === "ok" ? (
            <>
              <div className="appcard-top"><span className="appname">You're in</span><span className="status live">Joined</span></div>
              <p className="apptag">You've joined {orgName}. Ask an admin to assign you a seat, then open your apps.</p>
              <div className="appcard-foot"><a className="btn btn-primary btn-sm" href="/dashboard">Go to dashboard</a></div>
            </>
          ) : state === "invalid" ? (
            <>
              <div className="appcard-top"><span className="appname">Invite not valid</span><span className="status coming_soon">Expired</span></div>
              <p className="apptag">This invite link is invalid, already used, or was revoked. Ask your admin to send a new one.</p>
              <div className="appcard-foot"><a className="btn btn-ghost btn-sm" href="/dashboard">Go to dashboard</a></div>
            </>
          ) : (
            <>
              <div className="appcard-top"><span className="appname">Not available</span></div>
              <p className="apptag">Invites aren't available yet (service-role key not configured).</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
