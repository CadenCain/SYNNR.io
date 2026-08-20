import Link from "next/link";
import {
  Warehouse, Plus, Upload, AlertTriangle, Clock, ShieldCheck, Gauge, Truck,
  Flame, Activity, HardHat, Sparkles, Trash2,
} from "lucide-react";
import type { ComplianceStatus } from "@/lib/saas/db";
import type { UnitTile } from "@/lib/saas/readiness";
import { Card } from "@/components/ui/card";
import { buttonClass, Button } from "@/components/ui/button";
import { StatusBadge, StatusDot } from "@/components/ui/status-badge";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import ShareProof from "./share-proof";
import { loadSampleYard, clearSampleYard } from "../_actions";
import { Sparkline } from "@/components/ui/sparkline";
import { fmtDate } from "@/lib/saas/format";
import { TrendChart } from "./trend-chart";

/**
 * The dashboard's presentation, split from its data-fetching so the same
 * screen can render from live records (the real page) or from a fixed sample
 * (the marketing screenshots). One layout, photographed as-is — the pictures
 * on the site can never drift from what a customer actually gets.
 */

export interface DashItem { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }
export interface DashEvent { kind: string; message: string; actor: string | null; created_at: string; }
export interface DashSnap { day: string; readiness: number | null; misses_caught: number; }

export interface DashboardData {
  first: string;
  companyName: string;
  nptDay: number;
  yardCount: number;
  yards: { id: string; name: string }[];
  activeYard: { id: string; name: string } | null;
  boardUnits: UnitTile[];
  notReadyUnits: number;
  readiness: number | null;
  expiring30: number;
  missesCaught: number;
  missThisWk: number;
  missLastWk: number;
  warningsMonth: number;
  notReadyMonth: number;
  checksRunMonth: number;
  hasSample: boolean;
  events: DashEvent[];
  actionList: DashItem[];
  spark: { readiness: (number | null)[]; misses: (number | null)[] };
  snaps: DashSnap[];
}

const STATE_UI = {
  ready: { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready" },
  due_soon: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon" },
  not_ready: { chip: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready" },
  not_setup: { chip: "border-line-2 bg-elevated text-ink-faint", label: "Not set up" },
} as const;
const STATE_ORDER: Record<UnitTile["state"], number> = { not_ready: 0, due_soon: 1, ready: 2, not_setup: 3 };

export default function DashboardView(d: DashboardData) {
  const hrefFor = (i: DashItem) => i.parent_type === "unit" ? `/app/units/${i.parent_id}` : i.parent_type === "crew" ? `/app/crew/${i.parent_id}` : `/app/assets/${i.parent_id}`;
  const delta = (now: number, prev: number) =>
    now === prev ? "even with last week" : now > prev ? `+${now - prev} vs last week` : `${now - prev} vs last week`;

  const kpis: { icon: typeof Gauge; label: string; value: string | number; accent: string; href: string; bar?: number; sub?: string; spark?: (number | null)[]; sparkColor?: string }[] = [
    { icon: Truck, label: d.activeYard ? `Not ready — ${d.activeYard.name}` : "Not ready", value: d.notReadyUnits, accent: d.notReadyUnits > 0 ? "text-red-400" : "text-emerald-400", href: "#fleet", sub: d.notReadyUnits > 0 ? "units failing right now — fix these first" : "every unit current" },
    d.readiness === null
      ? { icon: Gauge, label: "Readiness", value: "Not set up yet", accent: "text-ink-faint", href: "/app/compliance", sub: "add gear & certs to score it" }
      : { icon: Gauge, label: "Readiness", value: `${d.readiness}%`, accent: d.readiness >= 90 ? "text-emerald-400" : d.readiness >= 60 ? "text-amber-400" : "text-red-400", bar: d.readiness, href: "/app/compliance", spark: d.spark.readiness, sparkColor: "#e7ddc7" },
    { icon: Flame, label: "Misses caught", value: d.missesCaught, accent: d.missesCaught > 0 ? "text-emerald-400" : "text-ink-dim", href: "#activity", sub: d.missesCaught > 0 ? `before rollout · ${delta(d.missThisWk, d.missLastWk)}` : "before rollout, this month", spark: d.spark.misses, sparkColor: "#34d399" },
    { icon: Clock, label: "Expiring in 30d", value: d.expiring30, accent: "text-amber-400", href: "/app/alerts" },
    { icon: AlertTriangle, label: "Failed checks", value: d.notReadyMonth, accent: d.notReadyMonth > 0 ? "text-red-400" : "text-ink-dim", href: "#activity", sub: "recorded this month" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Hello, {d.first}</h1>
          <p className="mt-1 text-sm text-ink-dim">Here&apos;s where {d.companyName} stands right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareProof scope="company" />
          <Link href="/app/dispatch" className={buttonClass("default")}>
            <Truck className="h-[18px] w-[18px]" /> Check readiness
          </Link>
        </div>
      </div>

      {/* ── MOBILE VERDICT — the fleet's state in one glance, one thumb. ── */}
      {d.yardCount > 0 && d.boardUnits.length > 0 && (() => {
        const sorted = [...d.boardUnits].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
        const worst = sorted[0];
        const dueSoon = d.boardUnits.filter((u) => u.state === "due_soon");
        if (d.notReadyUnits > 0) {
          return (
            <section className="md:hidden">
              <Card className="border-red-500/40 bg-red-500/[0.06] p-5">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-red-400">Not ready</div>
                <p className="mt-2 text-2xl font-semibold leading-snug">
                  {d.notReadyUnits === 1 ? `${worst.name} can't roll.` : `${d.notReadyUnits} units can't roll.`}
                </p>
                <p className="mt-1 truncate text-sm text-red-300">{worst.why}</p>
                <div className="mt-4 flex gap-2">
                  <Link href={`/app/units/${worst.id}`} className="flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-lg bg-bone px-4 font-semibold text-coal">
                    <span className="truncate">Fix {worst.name}</span>
                  </Link>
                  {d.notReadyUnits > 1 && (
                    <a href="#fleet" className="flex min-h-12 items-center justify-center rounded-lg border border-line-2 px-4 text-sm text-ink">
                      All {d.notReadyUnits}
                    </a>
                  )}
                </div>
              </Card>
            </section>
          );
        }
        if (dueSoon.length > 0) {
          return (
            <section className="md:hidden">
              <Card className="border-amber-500/30 bg-amber-500/[0.05] p-5">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400">Rolling ready · {dueSoon.length} due soon</div>
                <p className="mt-2 text-2xl font-semibold leading-snug">Nothing blocks a truck today.</p>
                <p className="mt-1 truncate text-sm text-ink-dim">{dueSoon[0].name}: {dueSoon[0].why}</p>
                <Link href={`/app/units/${dueSoon[0].id}`} className="mt-4 flex min-h-12 items-center justify-center rounded-lg bg-bone px-4 font-semibold text-coal">
                  Renew before it bites
                </Link>
              </Card>
            </section>
          );
        }
        return (
          <section className="md:hidden">
            <Card className="border-emerald-500/30 bg-emerald-500/[0.05] p-5">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">Rolling ready</div>
              <p className="mt-2 text-2xl font-semibold leading-snug">
                {d.boardUnits.length === 1 ? "Your unit is ready to roll." : `All ${d.boardUnits.length} units ready to roll.`}
              </p>
              {d.readiness !== null && <p className="mt-1 text-sm text-ink-dim">Readiness {d.readiness}%</p>}
              <Link href="/app/dispatch" className="mt-4 flex min-h-12 items-center justify-center rounded-lg border border-line-2 px-4 text-sm font-medium text-ink">
                <Truck className="mr-2 h-4 w-4" /> Check readiness
              </Link>
            </Card>
          </section>
        );
      })()}

      {/* Mobile: the three numbers that matter, quiet. */}
      {d.yardCount > 0 && (
        <div className="flex items-stretch divide-x divide-line rounded-lg border border-line md:hidden">
          {[
            { k: "Readiness", v: d.readiness === null ? "—" : `${d.readiness}%`, href: "/app/compliance" },
            { k: "Expiring 30d", v: d.expiring30, href: "/app/alerts" },
            { k: "Caught", v: d.missesCaught, href: "#activity" },
          ].map((s) => (
            <Link key={s.k} href={s.href} className="flex flex-1 flex-col items-center gap-0.5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</span>
              <span className="text-lg font-semibold tabular-nums">{s.v}</span>
            </Link>
          ))}
        </div>
      )}

      {/* KPI strip — every number clickable, every number honest (desktop) */}
      <div className="hidden gap-3 md:grid md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href}>
              <Card className="h-full p-4 transition-colors hover:border-line-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-dim">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.accent}`} />
                </div>
                <div className={`mt-3 font-semibold tabular-nums tracking-tight ${typeof k.value === "string" && k.value.length > 6 ? "text-lg text-ink-dim" : "text-3xl"}`}>{k.value}</div>
                {typeof k.bar === "number" ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${k.bar >= 90 ? "bg-emerald-500" : k.bar >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${k.bar}%` }} />
                  </div>
                ) : (
                  <div className="mt-1.5 min-h-4 truncate text-xs leading-4 text-ink-faint">{k.sub ?? ""}</div>
                )}
                {k.spark ? (
                  <div className="mt-1.5 flex items-center">
                    <Sparkline values={k.spark} stroke={k.sparkColor ?? "#9a9aa2"} />
                  </div>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── THE TREND BLOCK — the 14-day picture next to the month's tape.
          A owner reads direction here, not a number: is the yard getting
          tighter or looser, and what did the system do about it. ── */}
      {d.yardCount > 0 && d.snaps.length >= 2 && (
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Readiness — last 14 days</h2>
              <span className="text-xs text-ink-faint">daily 6:30am · today live</span>
            </div>
            <div className="mt-4">
              <TrendChart snaps={d.snaps} />
            </div>
          </Card>
          <Card className="grid grid-cols-2 content-center gap-x-4 gap-y-5 p-5">
            {[
              { k: "Checks run", v: d.checksRunMonth, tone: "text-ink" },
              { k: "Not ready", v: d.notReadyMonth, tone: d.notReadyMonth > 0 ? "text-red-400" : "text-ink" },
              { k: "Warnings sent", v: d.warningsMonth, tone: "text-amber-400" },
              { k: "Misses caught", v: d.missesCaught, tone: d.missesCaught > 0 ? "text-emerald-400" : "text-ink" },
            ].map((s) => (
              <div key={s.k}>
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{s.k}</div>
                <div className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone}`}>{s.v}</div>
                <div className="text-[11px] text-ink-faint">this month</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {d.yardCount === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <Warehouse className="h-8 w-8 text-ink-faint" />
          <div>
            <p className="font-medium">Your yard isn&apos;t set up yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">Add a yard and a truck, or load a sample yard to see the whole system working — trucks, certs, crew, and the readiness check.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/yards" className={buttonClass("default")}><Plus className="h-[18px] w-[18px]" /> Add your yard</Link>
            <Link href="/app/import" className={buttonClass("outline")}><Upload className="h-[18px] w-[18px]" /> Import a list</Link>
            <form action={loadSampleYard}>
              <Button type="submit" variant="outline"><Sparkles className="h-[18px] w-[18px]" /> Load sample yard</Button>
            </form>
          </div>
        </Card>
      ) : (
        <>
          {/* Fleet Readiness Board */}
          {d.boardUnits.length + (d.activeYard ? 1 : 0) > 0 && (
            <section id="fleet" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Fleet readiness board{d.activeYard ? ` — ${d.activeYard.name}` : ""}</h2>
                {d.hasSample && (
                  <form action={clearSampleYard}>
                    <button type="submit" className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-red-400">
                      <Trash2 className="h-3 w-3" /> Clear sample data
                    </button>
                  </form>
                )}
              </div>
              {d.yards.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <Link href="/app"
                    className={`rounded-sm border px-3 py-1 text-xs font-medium ${!d.activeYard ? "border-bone bg-bone text-coal" : "border-line-2 text-ink-dim hover:text-ink"}`}>
                    All yards
                  </Link>
                  {d.yards.map((y) => (
                    <Link key={y.id} href={`/app?yard=${y.id}`}
                      className={`rounded-sm border px-3 py-1 text-xs font-medium ${d.activeYard?.id === y.id ? "border-bone bg-bone text-coal" : "border-line-2 text-ink-dim hover:text-ink"}`}>
                      {y.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...d.boardUnits].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]).map((u) => (
                  <Link key={u.id} href={`/app/units/${u.id}`}>
                    <Card className={`h-full p-4 transition-colors hover:border-line-2 ${u.state === "not_ready" ? "border-red-500/40" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-ink-faint">{u.yardName}</div>
                        </div>
                        <span className={`shrink-0 rounded-sm border px-2.5 py-0.5 text-xs font-semibold ${STATE_UI[u.state].chip}`}>{STATE_UI[u.state].label}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${u.state === "not_ready" ? "text-red-300" : "text-ink-dim"}`}>{u.why}</span>
                        {u.crewWorst ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint" title="Assigned crew cards">
                            <HardHat className="h-3 w-3" /> <StatusDot status={u.crewWorst} />
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
            {/* Activity feed */}
            <section id="activity" className="flex flex-col gap-3">
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Activity</h2>
              {d.events.length === 0 ? (
                <Card className="px-6 py-10 text-center text-sm text-ink-dim">
                  Nothing yet — run your first readiness check and the feed starts here.
                </Card>
              ) : (
                <Card className="flex max-h-[420px] flex-col gap-0 overflow-y-auto p-2">
                  {d.events.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.02]">
                      <span className="mt-1 shrink-0">
                        {e.kind === "rolled_out_override" || e.kind === "checkin_partial" || e.kind === "check_not_ready" ? <AlertTriangle className="h-4 w-4 text-red-400" />
                          : e.kind === "miss_caught" ? <Flame className="h-4 w-4 text-emerald-400" />
                          : e.kind === "renewed" ? <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          : e.kind === "alert_sent" ? <Activity className="h-4 w-4 text-amber-400" />
                          : <Truck className="h-4 w-4 text-ink-dim" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{e.message}</p>
                        <p className="text-xs text-ink-faint">
                          {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          {e.actor && !e.message.includes(e.actor) ? <> · {e.actor}</> : null}
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>

            {/* Proof panel + needs attention */}
            <div className="flex flex-col gap-7">
              <section className="flex flex-col gap-3">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">What SYNNR caught — this month</h2>
                <Card className="p-5">
                  {d.missesCaught === 0 && d.warningsMonth === 0 ? (
                    <p className="text-sm text-ink-dim">Run your first readiness check to see your saves. Every miss caught before it hits a location shows up here.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-lg font-semibold">
                        {d.missesCaught === 0
                          ? "Nothing's slipped through this month."
                          : <>SYNNR caught <span className="text-emerald-400">{d.missesCaught}</span> miss{d.missesCaught === 1 ? "" : "es"} before {d.missesCaught === 1 ? "it" : "they"} hit a location.</>}
                      </p>
                      {d.missesCaught > 0 ? (
                        <p className="text-sm text-ink-dim">
                          At an estimated <span className="text-ink">${d.nptDay.toLocaleString()}</span>/day of NPT per miss, that&apos;s roughly{" "}
                          <span className="font-medium text-emerald-400">${(d.missesCaught * d.nptDay).toLocaleString()}</span> in avoided downtime this month — against a $500-a-yard subscription.
                          <span className="mt-0.5 block text-xs text-ink-faint">Estimate, not a measured figure. <Link href="/app/settings/billing" className="underline hover:text-ink">Set your own NPT day-rate.</Link></span>
                        </p>
                      ) : null}
                      <p className="text-sm text-ink-dim">
                        {d.warningsMonth} expiry warning{d.warningsMonth === 1 ? "" : "s"} delivered · {d.notReadyMonth === 0 ? "no NOT-ready checks recorded" : `${d.notReadyMonth} NOT-ready check${d.notReadyMonth === 1 ? "" : "s"} recorded — see the feed`}
                      </p>
                    </div>
                  )}
                </Card>
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Needs attention</h2>
                  <Link href="/app/compliance" className="text-sm text-ink-dim hover:text-ink">View all →</Link>
                </div>
                {d.actionList.length === 0 ? (
                  <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    <p className="text-sm text-ink-dim">Nothing expiring soon. You&apos;re rolling ready.</p>
                  </Card>
                ) : (
                  <Table>
                    <thead><tr><Th>Item</Th><Th>Expires</Th><Th className="text-right">Status</Th></tr></thead>
                    <tbody>
                      {d.actionList.map((i) => (
                        <Tr key={i.id}>
                          <Td>
                            <Link href={hrefFor(i)} className="font-medium hover:underline">{i.title}</Link>
                            <span className="ml-2 text-xs text-ink-faint">{kindLabel(i.kind)}{i.parent_type === "crew" ? " · crew" : ""}</span>
                          </Td>
                          <Td className="tabular-nums text-ink-dim">{fmtDate(i.expiration_date)}</Td>
                          <Td className="text-right"><StatusBadge status={i.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
