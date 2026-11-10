import { requireCompany } from "@/lib/saas/auth";
import Ask from "./_synnr/ask";

// The layout's "%s · SYNNR" doesn't reach a page in its own folder.
export const metadata = { title: { absolute: "SYNNR" } };
export const dynamic = "force-dynamic";

/**
 * Home is one thing: ask SYNNR. No dashboard, no board. The question bar,
 * and what it knows about the company behind it.
 */
export default async function AskHome({ searchParams }: { searchParams: Promise<{ welcome?: string; joined?: string }> }) {
  const { company, user } = await requireCompany();
  const { welcome, joined } = await searchParams;
  const full = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  const firstName = full.split(/\s+/)[0] ?? "";
  return <Ask firstName={firstName} companyName={company.name} welcome={welcome ? "owner" : joined ? "joined" : null} />;
}
