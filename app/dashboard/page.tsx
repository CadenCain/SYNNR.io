import "./dashboard.css";
import { dashboardHtml } from "./dashboard-html";
import DashboardScripts from "./dashboard-scripts";
import { getDashboardData } from "@/lib/data/workspace";

export const metadata = {
  title: "SYNNR — Dashboard",
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  return (
    <>
      <div className="dash" dangerouslySetInnerHTML={{ __html: dashboardHtml(data) }} />
      <DashboardScripts />
    </>
  );
}
