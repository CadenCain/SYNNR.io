/**
 * Opens a private copy of the sample shop: made-up documents to ask
 * questions of, no sign-up. A plain form post, so a link scanner that only
 * opens pages never starts one.
 */
export function TryDemo({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <form method="post" action="/demo/start" className="contents">
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
