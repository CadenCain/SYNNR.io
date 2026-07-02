/**
 * Tiny inline sparkline from REAL daily snapshots (spec: no fabricated
 * trends). Fewer than 2 real points → an honest "no history yet" dash.
 * Server component — pure SVG, no client JS.
 */
export function Sparkline({
  values,
  className = "",
  stroke = "currentColor",
}: {
  values: (number | null)[];
  className?: string;
  stroke?: string;
}) {
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) {
    return <span className={`text-xs text-ink-faint ${className}`}>— no history yet</span>;
  }
  const w = 72, h = 20, pad = 2;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={x(last.i)} cy={y(last.v)} r="1.8" fill={stroke} />
    </svg>
  );
}
