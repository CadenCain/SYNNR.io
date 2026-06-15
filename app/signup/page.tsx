import { redirect } from "next/navigation";

/**
 * SYNNR uses passwordless magic-code sign-in, so signing up and signing in are
 * the same flow. /signup just routes to /login (preserving any ?next=) so the
 * URL people expect doesn't 404.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
}
