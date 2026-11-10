import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Three things: you, your people, and the bill. A hand only sees their own account. */
export default async function SettingsHub() {
  const { company } = await requireCompany();
  const manager = company.role === "owner" || company.role === "admin";
  const rows = [
    { href: "/app/settings/account", title: "Your account", desc: "Your name, your password, the company name" },
    ...(manager ? [
      { href: "/app/settings/team", title: "Team", desc: "Who's in, what they can do, invite your people" },
      { href: "/app/settings/billing", title: "Billing", desc: "Your plan and how you pay" },
    ] : []),
  ];
  return (
    <>
      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">Settings</h1>
        <p className="mt-1.5 text-sm text-ink-dim">{company.name}</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        {rows.map((r) => (
          <Link key={r.href} href={r.href}
            className="group flex items-center gap-4 border-b border-line bg-surface px-5 py-4 transition-colors last:border-b-0 hover:bg-elevated">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium text-ink">{r.title}</div>
              <div className="mt-0.5 text-[13px] text-ink-dim">{r.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </>
  );
}
