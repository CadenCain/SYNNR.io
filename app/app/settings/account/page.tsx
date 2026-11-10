import { requireCompany } from "@/lib/saas/auth";
import { PageHeader } from "@/components/ui/page-header";
import { canPerform } from "@/lib/saas/entitlements";
import AccountForms from "./forms";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

/** Your name, your password, and the company name. */
export default async function AccountSettings() {
  const { company, user } = await requireCompany();
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";
  return (
    <>
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Your account" description="Your name, your password, and your company's name." />
      {/* Who can fix a typo in this login's email from the Team page. */}
      <AccountForms name={name} email={user.email ?? ""} companyName={company.name} canRename={canPerform(company.role, "rename_company") && !company.is_demo}
        emailBy={company.is_demo ? null : company.role === "member" ? "manager" : company.role === "admin" ? "owner" : null} />
    </>
  );
}
