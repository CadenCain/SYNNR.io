import type { DashSnap } from "./dashboard-view";

/**
 * The 14-day readiness chart — server-rendered SVG, no client JS.
 *
 * Bars, not a line: each day is a discrete 6:30am snapshot, and a bar reads
 * honestly when days are missing (a gap stays a gap instead of a line
 * inventing a slope across it). Miss-caught days get a marker under the bar
 * so "the dip on Tuesday" and "we caught two that morning" line up visually.
 */
export function TrendChart({ snaps }: { snaps: DashSnap[] }) {
  const W = 640, H = 174, PAD_L = 34, PAD_B = 26, PAD_T = 8;
  const chartW = W - PAD_L - 8;
  const chartH = H - PAD_B - PAD_T;
  const n = Math.max(snaps.length, 1);
  const slot = chartW / n;
  const barW = Math.min(slot * 0.62, 34);

  const y = (v: number) => PAD_T + chartH - (v / 100) * chartH;
  const color = (v: number | null) =>
    v === null ? "rgba(255,255,255,0.08)" : v >= 90 ? "#34d399" : v >= 60 ? "#f5b02e" : "#f87171";

  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString([], { weekday: "narrow" });
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Readiness over the last ${snaps.length} days`}>
      {/* gridlines at 0 / 50 / 100 */}
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={PAD_L} x2={W - 8} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          <text x={PAD_L - 6} y={y(g) + 3.5} textAnchor="end" fontSize="10"
            fill="rgba(236,229,215,0.35)" fontFamily="monospace">{g}</text>
        </g>
      ))}
      {snaps.map((s, i) => {
        const cx = PAD_L + slot * i + slot / 2;
        const v = s.readiness;
        return (
          <g key={s.day}>
            {v === null ? (
              // no snapshot that day — an honest stub, not a fabricated bar
              <rect x={cx - barW / 2} y={y(4)} width={barW} height={y(0) - y(4)} rx="2" fill={color(null)} />
            ) : (
              <rect x={cx - barW / 2} y={y(v)} width={barW} height={Math.max(y(0) - y(v), 2)} rx="3" fill={color(v)} opacity="0.9" />
            )}
            {s.misses_caught > 0 && (
              <circle cx={cx} cy={y(0) + 8} r="2.5" fill="#34d399">
                <title>{`${s.misses_caught} miss${s.misses_caught === 1 ? "" : "es"} caught`}</title>
              </circle>
            )}
            {/* Weekday row: bigger, brighter, more headroom — 9.5px at 35%
                opacity read as smudges once the SVG scaled down on laptops. */}
            <text x={cx} y={H - 5} textAnchor="middle" fontSize="11.5" letterSpacing="0.5"
              fill="rgba(236,229,215,0.55)" fontFamily="monospace">{dayLabel(s.day)}</text>
          </g>
        );
      })}
    </svg>
  );
}
