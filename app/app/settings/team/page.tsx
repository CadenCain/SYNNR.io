import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InviteLink from "./invite-link";

export const dynamic = "force-dynamic";

async function createInvite(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const role = String(formData.get("role") ?? "member");
  const email = String(formData.get("email") ?? "").trim() || null;
  const db = await saasDb();
  const { error } = await db.from("saas_invitations").insert({ company_id: company.id, role, email });
  if (error) throw new Error(error.message);
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
            <span className="rounded-sm border border-line px-2.5 py-0.5 text-xs capitalize text-ink-dim">{m.role}</span>
          </Card>
        ))}
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">Pending invites</h2>
          {invites.map((iv) => (
            <Card key={iv.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink-dim">{iv.email || "Anyone with the link"} · {iv.role}</span>
              </div>
              <InviteLink url={`${origin}/invite/${iv.token}`} />
            </Card>
          ))}
        </section>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-medium text-ink">Invite a teammate</h3>
        <form action={createInvite} className="flex flex-col gap-3 sm:flex-row">
          <input name="email" type="email" placeholder="email (optional)"
            className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
          <select name="role" defaultValue="member"
            className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7] sm:w-36">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit">Create invite link</Button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">Generates a shareable link — send it however you like. (Email delivery coming soon.)</p>
      </Card>
    </div>
  );
}
