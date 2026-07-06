"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Pick the date this check is FOR. Reloads the server-computed check against
 * that date — a cert current today but lapsing before the job then reads NOT
 * ready. Defaults to today; only today-or-later is accepted.
 */
export default function JobDatePicker({ jobDate, today }: { jobDate: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink-dim sm:flex-row sm:items-center sm:gap-3">
      <span>Checking for the job on</span>
      <input
        type="date"
        min={today}
        value={jobDate}
        onChange={(e) => {
          const next = e.target.value || today;
          const q = new URLSearchParams(params.toString());
          if (next <= today) q.delete("job");
          else q.set("job", next);
          router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`);
        }}
        className="h-10 rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone"
      />
      {jobDate > today ? (
        <span className="text-xs text-ink-faint">Certs must be current through this date.</span>
      ) : (
        <span className="text-xs text-ink-faint">Rolling today — set a future date to check ahead.</span>
      )}
    </label>
  );
}
