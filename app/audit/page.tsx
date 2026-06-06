import AuditView from "./audit-view";
import { getAuditData } from "@/lib/data/workspace";

export const metadata = {
  title: "SYNNR — Audit",
};

export default async function AuditPage() {
  const data = await getAuditData();
  return <AuditView data={data} />;
}
