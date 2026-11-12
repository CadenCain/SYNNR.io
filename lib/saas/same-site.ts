/**
 * Whether a form post came from one of this site's own pages. A browser says
 * where a post came from (Origin, and on newer ones Sec-Fetch-Site). Another
 * site's page posting here, to sign a visitor into a login it picked, is
 * refused. A request that says nothing about where it came from (an old
 * browser, a script) is let through: the token or the rate cap behind the
 * route is what guards those.
 */
export function fromThisSite(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host);
  } catch {
    return false;
  }
}
