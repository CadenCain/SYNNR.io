import "../../../marketing.css";
import "../../../apps/apps.css";
import "../tallyshot.css";
import { requireProduct } from "@/lib/marketplace/access";
import { getServerSupabase } from "@/lib/supabase/server";
import { SiteNav } from "../../../site-chrome";
import AppSwitcher from "../../app-switcher";
import RecordsList, { type RecRow } from "./records-list";

export const metadata = { title: "Saved tallies — TallyShot" };

export default async function RecordsPage() {
  const { check } = await requireProduct("tallyshot");

  let rows: RecRow[] = [];
  if (check.allowed) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { data } = await supabase
        .from("tallies")
        .select("id, well_name, rig, sheet_no, grand_total_ft, joint_count, flagged_count, confirmed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      rows = (data ?? []) as RecRow[];
    }
  }

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <AppSwitcher current="tallyshot" />
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">TallyShot · records</span>
          <h1 className="h2">Saved tallies</h1>
          <p className="lede" style={{ marginInline: 0 }}>Every tally your team has saved — by well, with totals and review status. Your whole org sees this; open any to view or re-export.</p>
        </div>

        {!check.allowed ? (
          <p className="apps-note" style={{ textAlign: "left" }}>{check.reason}</p>
        ) : rows.length === 0 ? (
          <div className="ts-empty">
            <b>No saved tallies yet</b>
            <p>Scan a sheet, confirm the flagged digits, then “Save to records” — it’ll show up here for the whole team.</p>
            <a className="btn btn-primary" href="/app/tallyshot">Scan a tally</a>
          </div>
        ) : (
          <RecordsList rows={rows} />
        )}
      </main>
    </div>
  );
}
