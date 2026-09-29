/**
 * Shown the instant a link is tapped, while the next page loads. The menu
 * stays put (it's in the layout), so a tap always answers right away
 * instead of the screen sitting still.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 rounded-lg bg-elevated" />
        <div className="h-4 w-72 max-w-full rounded bg-elevated/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-[98px] rounded-2xl border border-line bg-surface" />)}
      </div>
      <div className="h-11 rounded-lg border border-line bg-surface" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[72px] rounded-2xl border border-line bg-surface" />)}
      </div>
    </div>
  );
}
