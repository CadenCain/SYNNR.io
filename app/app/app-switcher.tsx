import { getSignedInOrg, getEntitlementContext } from "@/lib/marketplace/access";
import { PRODUCTS, canUseProduct } from "@/lib/catalog";

/**
 * In-app switcher: chips for every app the signed-in user can actually open,
 * with the current one marked. Lets a user with multiple apps toggle between
 * them; falls back to a Dashboard link.
 */
export default async function AppSwitcher({ current }: { current: string }) {
  const org = await getSignedInOrg();
  if (!org) return null;
  const ctx = await getEntitlementContext(org);
  const owned = PRODUCTS.filter((p) => canUseProduct(ctx, p.slug).allowed);

  return (
    <div className="app-switcher">
      <a className="as-home" href="/dashboard" title="Your apps">▦ Apps</a>
      {owned.map((p) => (
        <a key={p.slug} href={`/app/${p.slug}`} className={`as-chip${p.slug === current ? " on" : ""}`}>
          {p.name}
        </a>
      ))}
    </div>
  );
}
