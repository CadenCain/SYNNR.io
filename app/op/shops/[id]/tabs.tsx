"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/assets", label: "Assets" },
  { href: "/crew", label: "Crew" },
  { href: "/alerts", label: "Alerts" },
  { href: "/notes", label: "Notes" },
];

export default function ShopTabs({ shopId }: { shopId: string }) {
  const path = usePathname() || "";
  const base = `/op/shops/${shopId}`;
  return (
    <nav className="op-tabs" aria-label="Shop sections">
      {TABS.map((t) => {
        const href = base + t.href;
        const current =
          t.href === ""
            ? path === base
            : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={t.label} href={href} aria-current={current ? "page" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
