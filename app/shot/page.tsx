import type { Metadata } from "next";
import EquipmentView from "@/app/app/_components/equipment-view";
import YardMap from "@/app/app/_components/yard-map";
import AppNav from "@/app/app/_components/app-nav";
import { demoEquipment, demoTrucks } from "./fixtures";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Screenshot harness. Renders the REAL equipment screen and the REAL nav
 * with the demo yard's data (app/shot/fixtures.ts) so headless Chrome can
 * photograph the actual product for the marketing site: the pictures can
 * never drift from what ships. noindexed; it's a camera stand. The public,
 * linkable version of this is /demo.
 */
export default async function Shot({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const { companyName, list } = demoEquipment();
  return (
    <div className="saas relative min-h-dvh bg-coal text-ink antialiased md:flex">
      <AppNav companyName={companyName} userName="Demo manager" reviewCount={1} />
      <div className="relative z-10 min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {view === "map"
            ? <YardMap rows={list.rows} trucks={demoTrucks()} yards={list.yards} />
            : <EquipmentView list={list} companyName={companyName} />}
        </main>
      </div>
    </div>
  );
}
