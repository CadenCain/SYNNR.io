import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The cron heartbeat.
 *
 * A sweep that ran fine and had nothing to send used to leave no trace, so
 * "quiet morning" and "cron is dead" looked exactly the same from the outside.
 * /op/health was reduced to guessing from the last alert timestamp, which goes
 * stale the moment every due item has already had its one alert — and then it
 * reports "customers are not being warned" on a perfectly healthy system.
 *
 * Every run writes a row here, pass or fail. Never let a logging failure take
 * down the sweep that actually matters.
 */
export async function logCronRun(
  admin: SupabaseClient,
  row: {
    job: string;
    ok: boolean;
    companies_scanned?: number;
    alerts_sent?: number;
    errors?: number;
    detail?: string | null;
  },
): Promise<void> {
  try {
    await admin.from("saas_cron_runs").insert({
      job: row.job,
      ok: row.ok,
      companies_scanned: row.companies_scanned ?? 0,
      alerts_sent: row.alerts_sent ?? 0,
      errors: row.errors ?? 0,
      // Keep it short — this is a breadcrumb, not a log aggregator.
      detail: row.detail ? row.detail.slice(0, 2000) : null,
    });
  } catch (e) {
    console.error("[cron-log] heartbeat write failed:", e instanceof Error ? e.message : e);
  }
}
