import Link from "next/link";
import { Bell, Users, CreditCard, ChevronRight, Download, Share2, ShieldCheck } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsHub() {
  const { company } = await requireCompany();
  const rows = [
    { href: "/app/settings/notifications", icon: Bell, title: "Notifications", desc: "Lead time, recipients, email alerts", live: true },
    { href: "/app/settings/team", icon: Users, title: "Team", desc: "Invite members, manage roles", live: true },
    { href: "/app/settings/billing", icon: CreditCard, title: "Billing", desc: "Plan, yards, payment", live: true },
    { href: "/app/settings/proofs", icon: Share2, title: "Readiness proofs", desc: "Share links you've created — view or revoke", live: true },
    { href: "/app/settings/enforcement", icon: ShieldCheck, title: "Check-out enforcement", desc: "Photo proof on flagged items, second-person sign-off", live: true },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-ink-dim">{company.name}</p>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2 hover:bg-surface">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                  <Icon className="h-5 w-5 text-ink-dim" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.title}</div>
                  <div className="truncate text-sm text-ink-dim">{r.desc}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          );
        })}
        {/* Plain <a> so the browser downloads the CSV instead of client-routing */}
        <a href="/api/saas/export">
          <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2 hover:bg-surface">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
              <Download className="h-5 w-5 text-ink-dim" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Export data</div>
              <div className="truncate text-sm text-ink-dim">Download every item as CSV — your data, always yours</div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
          </Card>
        </a>
      </div>
    </div>
  );
}
