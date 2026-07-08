import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 16 Proxy (formerly Middleware). Refreshes the Supabase auth session
 * cookie on each request so Server Components see a current session. Real
 * authorization lives in the route Server Components (per Next.js guidance).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Referral attribution: a partner link (?ref=cody) can land ANYWHERE on the
  // site — persist it 30 days so it survives browsing until signup. First
  // touch wins (don't let a later plain visit overwrite the referrer).
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && !request.cookies.get("synnr_ref")) {
    response.cookies.set("synnr_ref", ref.slice(0, 60), {
      maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax",
    });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch the session so expired tokens refresh into the response cookies.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
