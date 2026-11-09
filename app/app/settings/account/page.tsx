import { requireCompany } from "@/lib/saas/auth";
import { PageHeader } from "@/components/ui/page-header";
import { canPerform } from "@/lib/saas/entitlements";
import AccountForms from "./forms";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

/** Your name (it goes on every scan), your password, and the company name. */
export default async function AccountSettings() {
  const { company, user } = await requireCompany();
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Your account" description="The name on every scan you make, your password, and your company's name." />
      <AccountForms name={name} email={user.email ?? ""} companyName={company.name} canRename={canPerform(company.role, "rename_company") && !company.is_demo} />
    </div>
  );
}
