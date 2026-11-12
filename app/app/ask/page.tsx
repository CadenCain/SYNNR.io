import { requireCompany } from "@/lib/saas/auth";
import Ask from "../_synnr/ask";

export const metadata = { title: "Ask" };
export const dynamic = "force-dynamic";

/** Ask SYNNR: one bar. It doesn't answer yet, and says so. */
export default async function AskPage() {
  const { company, user } = await requireCompany();
  const full = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  return <Ask firstName={full.split(/\s+/)[0] ?? ""} companyName={company.name} />;
}
