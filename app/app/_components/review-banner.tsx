"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Phone-only reminder that uploads are waiting. Hidden on the Review page itself. */
export default function ReviewBanner({ count }: { count: number }) {
  const path = usePathname();
  if (!count || path?.startsWith("/app/review")) return null;
  return (
    <Link href="/app/review" className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300 md:hidden">
      <span><span className="font-semibold">{count} upload{count === 1 ? "" : "s"}</span> waiting on your OK</span>
      <span className="font-medium underline underline-offset-2">Review</span>
    </Link>
  );
}
