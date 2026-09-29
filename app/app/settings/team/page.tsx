import { fmtDay } from "@/lib/saas/format";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InviteLink from "./invite-link";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Manager", member: "Hand" };

export const dynamic = "force-dynamic";

async function createInvite(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  // Members can look but not mint invites, and NOBODY mints an owner through
  // this form — a member could otherwise invite themselves an owner account.
  if (company.role !== "owner" && company.role !== "admin") throw new Error("Only a manager can invite people.");
  const requested = String(formData.get("role") ?? "member");
  const role = requested === "admin" ? "admin" : "member";
  const email = String(formData.get("email") ?? "").trim() || null;
  const db = await saasDb();
  // 7-day life set explicitly (DB default is 14). Acceptance already makes a
  // link single-use — status flips to accepted and the RPC refuses it after.
  const expires_at = new Date(Date.now() + 7 * 86400e3).toISOString();
  const { error } = await db.from("saas_invitations").insert({ company_id: company.id, role, email, expires_at });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/team");
}

async function transferOwnership(formData: FormData) {
  "use server";
  const { company, user } = await requireCompany();
  // The crown moves only by the owner's own hand.
  if (company.role !== "owner") throw new Error("Only the account owner can transfer ownership.");
  const targetUserId = String(formData.get("user_id") ?? "");
  if (!targetUserId || targetUserId === user.id) return;
  const admin = saasAdmin();
  if (!admin) throw new Error("Not configured.");
  const { data: target } = await admin.from("saas_memberships").select("user_id, role")
    .eq("company_id", company.id).eq("user_id", targetUserId).eq("status", "active").maybeSingle();
  if (!target || (target as { role: string }).role !== "admin") {
    throw new Error("Ownership can only go to a manager. Make them a manager first.");
  }
  // Service role (sessions hold no UPDATE on memberships). Promote first,
  // then demote — a crash between leaves two owners (safe, fixable) rather
  // than zero (locked out).
  await admin.from("saas_memberships").update({ role: "owner" })
    .eq("company_id", company.id).eq("user_id", targetUserId);
  await admin.from("saas_memberships").update({ role: "admin" })
    .eq("company_id", company.id).eq("user_id", user.id);
  revalidatePath("/app/settings/team");
}

async function revokeInvite(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  if (company.role !== "owner" && company.role !== "admin") throw new Error("Only a manager can revoke an invite.");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = await saasDb();
  // Any status other than 'pending' kills the link — the accept RPC checks it.
  await db.from("saas_invitations").update({ status: "revoked" }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/team");
}

export default async function TeamSettings() {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  const admin = saasAdmin();

  const { data: memberData } = await db
    .from("saas_memberships").select("user_id, role").eq("company_id", company.id).eq("status", "active");
  const members = (memberData ?? []) as { user_id: string; role: string }[];

  // Resolve emails via admin (auth.users isn't readable through RLS).
  const emails = new Map<string, string>();
  if (admin) {
    for (const m of members) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data?.user?.email) emails.set(m.user_id, data.user.email);
    }
  }

  const { data: invData } = await db
    .from("saas_invitations").select("id, token, role, email, status, expires_at")
    .eq("company_id", company.id).eq("status", "pending").order("created_at", { ascending: false });
  const invites = (invData ?? []) as { id: string; token: string; role: string; email: string | null; status: string; expires_at: string }[];

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-ink-dim">Who can see and edit {company.name}.</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ink">Members</h2>
        {members.map((m) => (
          <Card key={m.user_id} className="flex items-center justify-between gap-3 p-4">
            <span className="truncate">{emails.get(m.user_id) ?? m.user_id}{m.user_id === user.id ? " (you)" : ""}</span>
            <span className="flex items-center gap-2">
              {company.role === "owner" && m.role === "admin" && m.user_id !== user.id ? (
                <form action={transferOwnership}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <button type="submit" className="rounded-lg border border-line-2 px-2.5 py-1 text-xs text-ink-dim hover:bg-elevated hover:text-ink"
                    title="Make this manager the owner. You become a manager.">
                    Make owner
                  </button>
                </form>
              ) : null}
              <span className="rounded-md border border-line px-2.5 py-0.5 text-xs text-ink-dim">{ROLE_LABEL[m.role] ?? m.role}</span>
            </span>
          </Card>
        ))}
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">Pending invites</h2>
          {invites.filter((iv) => iv.status === "pending" && new Date(iv.expires_at) > new Date()).map((iv) => (
            <Card key={iv.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink-dim">
                  {iv.email || "Anyone with the link"} · {ROLE_LABEL[iv.role] ?? iv.role} ·{" "}
                  <span className="text-ink-faint">expires {fmtDay(iv.expires_at)}</span>
                </span>
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={iv.id} />
                  <button type="submit" className="rounded-lg border border-line-2 px-2.5 py-1 text-xs text-ink-dim hover:bg-red-500/10 hover:text-red-400">
                    Revoke
                  </button>
                </form>
              </div>
              <InviteLink url={`${origin}/invite/${iv.token}`} />
            </Card>
          ))}
        </section>
      )}

      {company.role === "member" ? (
        <p className="text-sm text-ink-faint">Only a manager can invite people. Ask whoever runs your account.</p>
      ) : (
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-medium text-ink">Invite a teammate</h3>
        <form action={createInvite} className="flex flex-col gap-3 lg:flex-row">
          <input name="email" type="email" placeholder="email (optional)"
            className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#1d4ed8]" />
          <select name="role" defaultValue="member"
            className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#1d4ed8] lg:w-36">
            <option value="member">Hand</option>
            <option value="admin">Manager</option>
          </select>
          <Button type="submit">Create invite link</Button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">Makes a link you can text or send however you like. Hands upload certs and run readiness checks. Managers also approve uploads, type in dates, and set the rules.</p>
      </Card>
      )}
    </div>
  );
}
