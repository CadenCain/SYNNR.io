/**
 * Shown the instant a link is tapped, while the next page loads. The frame
 * stays put (it's in the layout), so a tap always answers right away.
 */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-14 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-44 animate-pulse rounded bg-elevated" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-elevated/60" />
    </div>
  );
}
