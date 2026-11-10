import { requireCompany } from "@/lib/saas/auth";
import Ask from "./_synnr/ask";

export const metadata = { title: "Ask" };
export const dynamic = "force-dynamic";

/**
 * Home is one thing: ask SYNNR. No dashboard, no board. The question bar,
 * and what it knows about the company behind it.
 */
export default async function AskHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { company, user } = await requireCompany();
  const { welcome } = await searchParams;
  const full = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  const firstName = full.split(/\s+/)[0] ?? "";
  return <Ask firstName={firstName} companyName={company.name} welcome={Boolean(welcome)} />;
}
