import "../marketing.css";
import "../apps/apps.css";
import "./team.css";
import { redirect } from "next/navigation";
import { getSignedInOrg } from "@/lib/marketplace/access";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getProduct } from "@/lib/catalog";
import { SiteNav } from "../site-chrome";
import InviteForm from "./invite-form";
import { revokeInviteForm, assignSeatForm, revokeSeatForm } from "./actions";

export const metadata = { title: "Team — SYNNR" };

export default async function TeamPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/team");

  const admin = getAdminSupabase();
  if (!admin || !org.workspaceId) {
    return (
      <div className="mkt">
        <SiteNav />
        <main className="container apps-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Team</span>
            <h1 className="h2">Team & seats</h1>
          </div>
          <p className="apps-note" style={{ textAlign: "left", marginTop: 0 }}>
            {org.workspaceId ? "Team management needs the service-role key configured." : "Set up your workspace to invite teammates."}
          </p>
        </main>
      </div>
    );
  }

  // self-heal: ensure the caller is a member (owner) of their workspace
  const { data: mine } = await admin.from("memberships").select("role").eq("user_id", org.userId).eq("workspace_id", org.workspaceId).maybeSingle();
  if (!mine) await admin.from("memberships").insert({ user_id: org.userId, workspace_id: org.workspaceId, role: "owner" });

  const [{ data: members }, { data: invites }, { data: subs }, { data: seatRows }] = await Promise.all([
    admin.from("memberships").select("user_id, role").eq("workspace_id", org.workspaceId),
    admin.from("invites").select("id, email, role, token, status").eq("workspace_id", org.workspaceId).eq("status", "pending"),
    admin.from("subscriptions").select("product_slug, seats, status").eq("workspace_id", org.workspaceId),
    admin.from("seat_assignments").select("product_slug, user_id").eq("workspace_id", org.workspaceId),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await admin.from("profiles").select("id, email, name").in("id", memberIds)
    : { data: [] as { id: string; email: string | null; name: string | null }[] };
  const emailOf = (id: string) => profiles?.find((p) => p.id === id)?.email ?? id.slice(0, 8);

  const activeSubs = (subs ?? []).filter((s) => s.product_slug && ["active", "trialing"].includes(s.status ?? ""));
  const seatsFor = (product: string, userId: string) => (seatRows ?? []).some((s) => s.product_slug === product && s.user_id === userId);
  const assignedCount = (product: string) => (seatRows ?? []).filter((s) => s.product_slug === product).length;
  const callerRole = mine?.role ?? "owner";
  const canManage = callerRole === "owner" || callerRole === "admin";

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">Team</span>
          <h1 className="h2">Team & seats</h1>
          <p className="lede" style={{ marginInline: 0 }}>Invite your hands and assign each one a seat for the apps you subscribe to.</p>
        </div>

        {canManage ? <InviteForm /> : null}

        {activeSubs.length === 0 ? (
          <p className="apps-note" style={{ textAlign: "left" }}>No active subscriptions yet — <a href="/apps">start a trial</a> to get seats to assign.</p>
        ) : (
          <div className="seat-caps">
            {activeSubs.map((s) => (
              <span key={s.product_slug} className="cap">
                {getProduct(s.product_slug!)?.name ?? s.product_slug}: <b>{assignedCount(s.product_slug!)}/{s.seats}</b> seats
              </span>
            ))}
          </div>
        )}

        <div className="member-list">
          {(members ?? []).map((m) => (
            <div key={m.user_id} className="member">
              <div className="m-id">
                <b>{emailOf(m.user_id)}{m.user_id === org.userId ? " (you)" : ""}</b>
                <span className="role">{m.role}</span>
              </div>
              <div className="m-seats">
                {activeSubs.map((s) => {
                  const has = seatsFor(s.product_slug!, m.user_id);
                  const full = assignedCount(s.product_slug!) >= (s.seats ?? 0);
                  const name = getProduct(s.product_slug!)?.name ?? s.product_slug;
                  return has ? (
                    <form key={s.product_slug} action={revokeSeatForm}>
                      <input type="hidden" name="product" value={s.product_slug!} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="seat on" disabled={!canManage} title={`Remove ${name} seat`}>{name} ✓</button>
                    </form>
                  ) : (
                    <form key={s.product_slug} action={assignSeatForm}>
                      <input type="hidden" name="product" value={s.product_slug!} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="seat" disabled={!canManage || full} title={full ? "No seats left" : `Assign ${name} seat`}>{name} +</button>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {invites && invites.length > 0 ? (
          <div className="invites">
            <h3 className="h3">Pending invites</h3>
            {invites.map((i) => (
              <div key={i.id} className="invite-row">
                <span>{i.email} · {i.role}</span>
                <code className="invite-link">/invite/{i.token}</code>
                {canManage ? (
                  <form action={revokeInviteForm}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn btn-ghost btn-sm">Revoke</button>
                  </form>
                ) : null}
              </div>
            ))}
            <p className="apps-note" style={{ textAlign: "left", marginTop: 10 }}>Share the invite link with each person (email delivery turns on with Resend).</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
