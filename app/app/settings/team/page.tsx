import { fmtDay, fmtWhen } from "@/lib/saas/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompany, requireBillableCompany, type ActiveCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { sendPasswordReset } from "@/lib/saas/password-reset";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import InviteLink from "./invite-link";
import { turnOverCrewLink, dropAlertRecipient, liveProofLinksBy, changeLoginEmail, offCrewNotice } from "./crew-changes";

export const metadata = { title: "Team" };

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Manager", member: "Hand" };
const isManager = (c: Pick<ActiveCompany, "role">) => c.role === "owner" || c.role === "admin";
const actorOf = (u: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  u.user_metadata?.full_name?.trim() || u.email?.split("@")[0] || "A manager";

export const dynamic = "force-dynamic";

/**
 * Who's on the crew. Everybody has their own login, so SYNNR knows who's
 * asking and every change has a name on it. A manager gets people on with one crew link
 * (texted to the whole crew, good for 30 days, anyone who taps it joins as a
 * hand) or a one-person invite (for a manager), and can make someone a
 * manager or a hand, send them a password reset, fix their login email, or
 * take them off the crew.
 */

async function makeCrewLink() {
  "use server";
  const { company } = await requireBillableCompany();
  if (!isManager(company)) throw new Error("Only a manager can make the crew link.");
  if (company.is_demo) throw new Error("Crew links are off in the demo yard.");
  const db = await saasDb();
  // One crew link at a time: a new one turns the old one off.
  await db.from("saas_invitations").update({ status: "revoked" }).eq("company_id", company.id).eq("multi_use", true).eq("status", "pending");
  const expires_at = new Date(Date.now() + 30 * 86400e3).toISOString();
  const { error } = await db.from("saas_invitations").insert({ company_id: company.id, role: "member", multi_use: true, expires_at });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/team");
}

async function createInvite(formData: FormData) {
  "use server";
  const { company } = await requireBillableCompany();
  // Nobody mints an owner through this form (and the database won't take one).
  if (!isManager(company)) throw new Error("Only a manager can invite people.");
  if (company.is_demo) throw new Error("Invites are off in the demo yard.");
  const role = String(formData.get("role") ?? "member") === "admin" ? "admin" : "member";
  const email = String(formData.get("email") ?? "").trim().slice(0, 254) || null;
  const db = await saasDb();
  // One person, one use, 7 days.
  const expires_at = new Date(Date.now() + 7 * 86400e3).toISOString();
  const { error } = await db.from("saas_invitations").insert({ company_id: company.id, role, email, expires_at });
  if (error) throw new Error(error.message);
  revalidatePath("/app/settings/team");
}

async function revokeInvite(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  if (!isManager(company)) throw new Error("Only a manager can turn off an invite.");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const db = await saasDb();
  await db.from("saas_invitations").update({ status: "revoked" }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/team");
}

/** A manager acting on someone else on the crew, never the owner and never themselves. */
async function target(formData: FormData) {
  const { company, user } = await requireCompany();
  if (!isManager(company)) throw new Error("Only a manager can change the crew.");
  const userId = String(formData.get("user_id") ?? "");
  const admin = saasAdmin();
  if (!admin || !userId || userId === user.id) return null;
  const { data } = await admin.from("saas_memberships").select("user_id, role")
    .eq("company_id", company.id).eq("user_id", userId).eq("status", "active").maybeSingle();
  const m = data as { user_id: string; role: string } | null;
  if (!m || m.role === "owner") return null;
  const { data: who } = await admin.auth.admin.getUserById(userId);
  const name = (who?.user?.user_metadata?.full_name as string | undefined)?.trim() || who?.user?.email || "Someone";
  return { company, user, admin, m, name, email: who?.user?.email ?? null };
}

async function setRole(formData: FormData) {
  "use server";
  const t = await target(formData);
  if (!t) return;
  const role = String(formData.get("role")) === "admin" ? "admin" : "member";
  if (role === t.m.role) return;
  await t.admin.from("saas_memberships").update({ role }).eq("company_id", t.company.id).eq("user_id", t.m.user_id);
  void logEvent({ companyId: t.company.id, kind: "crew_changed", actor: actorOf(t.user),
    message: `${actorOf(t.user)} made ${t.name} ${role === "admin" ? "a manager" : "a hand"}` });
  revalidatePath("/app/settings/team");
}

async function removeMember(formData: FormData) {
  "use server";
  const t = await target(formData);
  if (!t) return;
  // Off the crew: no access from their next tap. Their name stays on every
  // record they made. Their own login can't rejoin with the crew link, and
  // the link turns over so they can't make a new login with it either. They
  // come off the alert emails, and the manager hears about any proof links
  // they made that still work.
  const { error } = await t.admin.from("saas_memberships").update({ status: "removed" }).eq("company_id", t.company.id).eq("user_id", t.m.user_id);
  if (error) throw new Error("Couldn't take them off the crew. Try again.");
  const db = await saasDb();
  const [link, alerts, links] = await Promise.all([
    turnOverCrewLink(db, t.company),
    dropAlertRecipient(t.admin, t.company.id, t.email),
    liveProofLinksBy(t.admin, t.company.id, t.m.user_id),
  ]);
  void logEvent({ companyId: t.company.id, kind: "crew_changed", actor: actorOf(t.user),
    message: `${actorOf(t.user)} took ${t.name} off the crew` });
  revalidatePath("/app/settings/team");
  redirect(`/app/settings/team?off=1&link=${link ?? ""}&alerts=${alerts}&links=${links}`);
}

async function sendReset(formData: FormData) {
  "use server";
  const t = await target(formData);
  if (!t?.email) return;
  await sendPasswordReset(t.admin, t.email);
  revalidatePath("/app/settings/team");
}

/** A typo in a hand's login email: a manager fixes it here (the owner can for a manager too). */
async function changeEmail(formData: FormData) {
  "use server";
  const t = await target(formData);
  if (!t) return;
  if (t.company.is_demo) throw new Error("Logins can't be changed in the demo yard.");
  if (t.m.role !== "member" && t.company.role !== "owner") throw new Error("Only the owner can change a manager's login email.");
  const raw = String(formData.get("email") ?? "");
  if (raw.trim().toLowerCase() === (t.email ?? "").toLowerCase()) return;
  const r = await changeLoginEmail(t.admin, t.company.id, t.m.user_id, raw);
  if (!r.ok) redirect(`/app/settings/team?err=${encodeURIComponent(r.error)}`);
  void logEvent({ companyId: t.company.id, kind: "crew_changed", actor: actorOf(t.user),
    message: `${actorOf(t.user)} changed ${t.name}'s login email` });
  revalidatePath("/app/settings/team");
  redirect("/app/settings/team?email=1");
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
  const { data: t } = await admin.from("saas_memberships").select("user_id, role")
    .eq("company_id", company.id).eq("user_id", targetUserId).eq("status", "active").maybeSingle();
  if (!t || (t as { role: string }).role !== "admin") {
    throw new Error("Ownership can only go to a manager. Make them a manager first.");
  }
  // Promote first, then demote: a crash between leaves two owners (safe,
  // fixable) rather than zero (locked out).
  await admin.from("saas_memberships").update({ role: "owner" }).eq("company_id", company.id).eq("user_id", targetUserId);
  await admin.from("saas_memberships").update({ role: "admin" }).eq("company_id", company.id).eq("user_id", user.id);
  // Handing over the company goes in the feed: who gave it to whom.
  const { data: who } = await admin.auth.admin.getUserById(targetUserId);
  const name = (who?.user?.user_metadata?.full_name as string | undefined)?.trim() || who?.user?.email || "someone";
  void logEvent({ companyId: company.id, kind: "crew_changed", actor: actorOf(user),
    message: `${actorOf(user)} made ${name} the owner and is now a manager` });
  revalidatePath("/app/settings/team");
}

/** The time now, read outside render (the page renders once per request). */
const clock = () => Date.now();

const small = "inline-flex min-h-10 items-center rounded-lg border border-line-2 px-3 text-sm text-ink transition-colors hover:bg-elevated md:min-h-8 md:text-[13px]";

export default async function TeamSettings({ searchParams }: { searchParams: Promise<{ off?: string; link?: string; alerts?: string; links?: string; email?: string; err?: string }> }) {
  const { company, user } = await requireCompany();
  const sp = await searchParams;
  const notice = sp.off ? offCrewNotice({
    link: sp.link === "new" || sp.link === "off" ? sp.link : null,
    alerts: Math.max(0, parseInt(sp.alerts ?? "", 10) || 0),
    links: Math.max(0, parseInt(sp.links ?? "", 10) || 0),
  }) : sp.email ? "Login email changed. If they need a new password too, tap Email them a password reset." : null;
  const db = await saasDb();
  const admin = saasAdmin();
  const manager = isManager(company);
  const now = clock();

  const { data: memberData } = await db
    .from("saas_memberships").select("user_id, role, created_at").eq("company_id", company.id).eq("status", "active");
  const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
  const members = ((memberData ?? []) as { user_id: string; role: string; created_at: string }[])
    .sort((a, b) => (order[a.role] ?? 3) - (order[b.role] ?? 3));

  // Names, emails, and last sign-in come from the auth accounts. A hand sees
  // who's on the crew by name; login emails and sign-in times are for managers
  // (and each person's own).
  const info = new Map<string, { name?: string; email?: string; lastIn?: string | null }>();
  if (admin) {
    await Promise.all(members.slice(0, 200).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      const mine = manager || m.user_id === user.id;
      info.set(m.user_id, {
        name: (data?.user?.user_metadata?.full_name as string | undefined)?.trim() || (mine ? undefined : data?.user?.email?.split("@")[0]),
        email: mine ? data?.user?.email : undefined,
        lastIn: mine ? data?.user?.last_sign_in_at ?? null : undefined,
      });
    }));
  }

  const { data: invData } = manager ? await db
    .from("saas_invitations").select("id, token, role, email, status, expires_at, multi_use, uses")
    .eq("company_id", company.id).eq("status", "pending").gt("expires_at", new Date(now).toISOString())
    .order("created_at", { ascending: false }) : { data: [] };
  type Inv = { id: string; token: string; role: string; email: string | null; status: string; expires_at: string; multi_use: boolean; uses: number };
  const invites = (invData ?? []) as Inv[];
  const crewLink = invites.find((iv) => iv.multi_use) ?? null;
  const personal = invites.filter((iv) => !iv.multi_use);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.synnr.io";
  const lastInText = (iso: string | null | undefined) => {
    if (!iso) return "Hasn't signed in yet";
    const days = Math.floor((now - Date.parse(iso)) / 86400e3);
    return days <= 0 ? "Signed in today" : days === 1 ? "Signed in yesterday" : `Last signed in ${fmtDay(iso)}`;
  };

  return (
    <>
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Team" description={`Everybody at ${company.name} gets their own login.`} />
      {notice ? <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p> : null}
      {sp.err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{sp.err.slice(0, 200)}</p> : null}

      {manager ? (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-ink">Crew link</h2>
            <p className="mt-0.5 text-sm text-ink-dim">Text one link to the whole crew. Each hand taps it, types their name, email, and a password, and they&apos;re in. Anyone with the link joins as a hand, so send it to your crew only.</p>
          </div>
          {company.is_demo ? (
            <p className="text-sm text-ink-dim">Off in the demo company: it&apos;s made up and deletes itself after a day, so real people can&apos;t join it. In your own account, this is where you make the link.</p>
          ) : crewLink ? (
            <>
              <InviteLink url={`${origin}/invite/${crewLink.token}`} company={company.name} />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-dim">
                <span>{crewLink.uses === 0 ? "Nobody has joined with it yet" : `${crewLink.uses} ${crewLink.uses === 1 ? "person has" : "people have"} joined with it`} · good until {fmtDay(crewLink.expires_at)}</span>
                <span className="flex flex-wrap gap-2">
                  <form action={makeCrewLink}><button type="submit" className={small}>Make a new link</button></form>
                  <form action={revokeInvite}><input type="hidden" name="id" value={crewLink.id} /><button type="submit" className={`${small} hover:text-red-400`}>Turn it off</button></form>
                </span>
              </div>
              <p className="text-xs text-ink-faint">A new link turns this one off. Anyone who already joined stays on. Taking someone off the crew makes a new link by itself.</p>
            </>
          ) : (
            <form action={makeCrewLink}><Button type="submit" className="w-full sm:w-auto">Make the crew link</Button></form>
          )}
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-[14px] font-medium text-ink">On the crew <span className="text-ink-faint">{members.length}</span></h2>
        {members.map((m) => {
          const i = info.get(m.user_id) ?? {};
          const me = m.user_id === user.id;
          const canManage = manager && !me && m.role !== "owner";
          const canChangeEmail = canManage && !company.is_demo && (m.role === "member" || company.role === "owner");
          const first = i.name?.split(/\s+/)[0] ?? "them";
          return (
            <Card key={m.user_id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-ink">{i.name ?? "No name yet"}{me ? " (you)" : ""}</span>
                  {manager || me ? (
                    <>
                      <span className="block break-all text-sm text-ink-dim">{i.email ?? ""}</span>
                      <span className="block text-[13px] text-ink-faint">{lastInText(i.lastIn)}</span>
                    </>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-md border border-line px-2.5 py-0.5 text-xs text-ink-dim">{ROLE_LABEL[m.role] ?? m.role}</span>
              </div>
              {canManage || (company.role === "owner" && m.role === "admin" && !me) ? (
                <details className="group">
                  <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-dim transition-colors hover:text-ink">Manage {first}</summary>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canManage ? (
                      <form action={setRole}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                        <button type="submit" className={small}>{m.role === "admin" ? "Make a hand" : "Make a manager"}</button>
                      </form>
                    ) : null}
                    {canManage && i.email ? (
                      <form action={sendReset}>
                        <input type="hidden" name="user_id" value={m.user_id} />
                        <button type="submit" className={small}>Email them a password reset</button>
                      </form>
                    ) : null}
                    {company.role === "owner" && m.role === "admin" && !me ? (
                      // Handing over the company asks first: only the new owner can give it back.
                      <AlertDialog>
                        <AlertDialogTrigger className={`${small} cursor-pointer`}>Make owner</AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Make {i.name ?? "them"} the owner?</AlertDialogTitle>
                            <AlertDialogDescription>You become a manager. {first} runs billing and the crew from then on, can take you off the crew, and is the only one who can give it back.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep it</AlertDialogCancel>
                            <form action={transferOwnership}>
                              <input type="hidden" name="user_id" value={m.user_id} />
                              <button type="submit" className={buttonClass("default", "default", "w-full")}>Make {first} the owner</button>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                    {canManage ? (
                      <AlertDialog>
                        <AlertDialogTrigger className={`${small} cursor-pointer border-red-500/40 text-red-400 hover:bg-red-500/10`}>Take off the crew</AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Take {i.name ?? "them"} off the crew?</AlertDialogTitle>
                            <AlertDialogDescription>They lose access right away. The crew link turns over, so the one they have stops working. Their name stays on everything they did.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep them on</AlertDialogCancel>
                            <form action={removeMember}>
                              <input type="hidden" name="user_id" value={m.user_id} />
                              <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-white hover:bg-red-400")}>Take {first} off</button>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                  {canChangeEmail ? (
                    <form action={changeEmail} className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input name="email" type="email" required defaultValue={i.email ?? ""} aria-label={`${first}'s login email`} autoCapitalize="none"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none focus:border-ink-faint md:h-10 md:text-sm" />
                      <button type="submit" className={small}>Fix their login email</button>
                    </form>
                  ) : null}
                  {canManage ? <p className="mt-2 text-xs text-ink-faint">Taking someone off ends their access right away and turns the crew link over, so the link they have stops working. Their name stays on everything they did.</p> : null}
                </details>
              ) : null}
            </Card>
          );
        })}
      </section>

      {manager && !company.is_demo ? (
        <Card className="flex flex-col gap-3 p-5">
          <div>
            <h2 className="text-[14px] font-medium text-ink">Invite one person</h2>
            <p className="mt-0.5 text-sm text-ink-dim">A link for one person, good for 7 days. Use it to bring back someone who was taken off the crew, or pick Manager for a manager. Managers can bring people in and run the team.</p>
          </div>
          <form action={createInvite} className="flex flex-col gap-3 sm:flex-row">
            <select name="role" defaultValue="member" aria-label="Joins as"
              className="h-11 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none focus:border-ink-faint sm:w-40 md:h-10 md:text-sm">
              <option value="member">Hand</option>
              <option value="admin">Manager</option>
            </select>
            <input name="email" type="email" placeholder="Their email (optional, for your list)" aria-label="Their email"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint md:h-10 md:text-sm" />
            <Button type="submit">Make the link</Button>
          </form>
          {personal.length ? (
            <div className="flex flex-col gap-3 border-t border-line pt-3">
              {personal.map((iv) => (
                <div key={iv.id} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 text-sm text-ink-dim">
                    <span className="min-w-0 break-all">{iv.email || "One person"} · {ROLE_LABEL[iv.role] ?? iv.role} · <span className="text-ink-faint">good until {fmtWhen(iv.expires_at)}</span></span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={iv.id} />
                      <button type="submit" className="text-sm text-ink-dim hover:text-red-400">Turn off</button>
                    </form>
                  </div>
                  <InviteLink url={`${origin}/invite/${iv.token}`} company={company.name} />
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : !manager ? (
        <p className="text-sm text-ink-faint">Only a manager can add people. Ask whoever runs your account for the crew link.</p>
      ) : null}
    </>
  );
}
