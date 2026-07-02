import Link from "next/link";
import { Bell, Settings2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ data: settingsData }, { data: itemData }, { data: sentData }, { data: recipData }] = await Promise.all([
    db.from("saas_notification_settings").select("email_enabled, lead_days, recipients").eq("company_id", company.id).maybeSingle(),
    db.from("saas_compliance_items_with_status")
      .select("id, title, expiration_date, status")
      .eq("company_id", company.id),
    db.from("saas_alerts_sent")
      .select("sent_at, channel, saas_compliance_items(title)")
      .eq("company_id", company.id)
      .order("sent_at", { ascending: false })
      .limit(50),
    db.from("saas_alert_recipients").select("name, channels").eq("company_id", company.id),
  ]);

  const s = settingsData as { email_enabled: boolean; lead_days: number; recipients: string[] } | null;
  const leadDays = s?.lead_days ?? 30;
  const routed = (recipData ?? []) as { name: string; channels: string[] }[];
  const legacy = (s?.recipients ?? []).filter(Boolean);
  const recipientLine = routed.length
    ? routed.map((r) => `${r.name}${r.channels.includes("sms") ? " (email + text)" : ""}`).join(", ")
    : legacy.length ? legacy.join(", ") : null;

  type Row = { id: string; title: string; expiration_date: string | null; status: ComplianceStatus };
  // Failing = expired OR no-date-on-file ("Missing" — unverifiable), plus due-soon.
  const upcoming = ((itemData ?? []) as Row[])
    .filter((i) => i.status === "expired" || i.status === "expiring" || i.status === "none")
    .sort((a, b) => {
      const rank = (s: string) => (s === "expired" ? 0 : s === "none" ? 1 : 2);
      return rank(a.status) - rank(b.status) || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
    });

  type Sent = { sent_at: string; channel: string; saas_compliance_items: { title: string } | { title: string }[] | null };
  const history = ((sentData ?? []) as Sent[]).map((h) => ({
    when: h.sent_at,
    channel: h.channel,
    title: (Array.isArray(h.saas_compliance_items) ? h.saas_compliance_items[0]?.title : h.saas_compliance_items?.title) ?? "(deleted item)",
  }));

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Alerts"
        description="We watch every date. You get the heads-up before it lapses."
        actions={<Link href="/app/settings/notifications" className={buttonClass("outline", "sm")}><Settings2 className="h-4 w-4" /> Settings</Link>}
      />

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl border border-line ${s?.email_enabled === false ? "bg-elevated text-ink-faint" : "bg-emerald-500/10 text-emerald-400"}`}>
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <div className="font-medium">{s?.email_enabled === false ? "Alerts off" : "Alerts on"}</div>
            <div className="text-sm text-ink-dim">Heads-up {leadDays} days before expiration · daily sweep at 6:30am CT</div>
          </div>
        </div>
        <div className="text-sm text-ink-dim">
          To: {recipientLine ?? "company owner (default)"} · <Link href="/app/settings/notifications" className="text-bone hover:underline">manage recipients</Link>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">In the alert window now</h2>
        {upcoming.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-ink-dim">Nothing inside {leadDays} days. You&apos;re rolling ready.</Card>
        ) : (
          <Table>
            <thead><tr><Th>Item</Th><Th>Expires</Th><Th className="text-right">Status</Th></tr></thead>
            <tbody>
              {upcoming.map((i) => (
                <Tr key={i.id}>
                  <Td className="font-medium">{i.title}</Td>
                  <Td className="tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</Td>
                  <Td className="text-right"><StatusBadge status={i.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Alerts sent</h2>
        {history.length === 0 ? (
          <Card className="px-6 py-10 text-center text-sm text-ink-dim">No alerts sent yet — the daily sweep logs them here.</Card>
        ) : (
          <Table>
            <thead><tr><Th>When</Th><Th>Item</Th><Th className="text-right">Channel</Th></tr></thead>
            <tbody>
              {history.map((h, idx) => (
                <Tr key={idx}>
                  <Td className="tabular-nums text-ink-dim">{new Date(h.when).toLocaleString()}</Td>
                  <Td className="font-medium">{h.title}</Td>
                  <Td className="text-right capitalize text-ink-dim">{h.channel}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
