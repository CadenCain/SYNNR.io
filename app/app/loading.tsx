// Skeleton shown while an /app route streams in.
export default function AppLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-44 rounded-md bg-elevated" />
        <div className="h-4 w-72 rounded bg-surface" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl border border-line bg-surface" />)}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl border border-line bg-surface" />)}
      </div>
    </div>
  );
}
