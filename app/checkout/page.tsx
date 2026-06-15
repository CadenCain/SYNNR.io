import "../marketing.css";
import "../apps/apps.css";
import "./checkout-ui.css";
import { SiteNav } from "../site-chrome";
import CheckoutClient from "./checkout-client";

export const metadata = { title: "Start your free trial — SYNNR" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; seats?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  // legacy ?plan= links → TallyShot per-seat
  const slug = sp.product || "tallyshot";
  const seats = Math.max(1, Math.floor(Number(sp.seats) || 1));

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container co-wrap">
        <CheckoutClient slug={slug} initialSeats={seats} />
      </main>
    </div>
  );
}
