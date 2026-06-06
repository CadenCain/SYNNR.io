import "./dashboard.css";
import { DASHBOARD_HTML } from "./dashboard-html";
import DashboardScripts from "./dashboard-scripts";

export const metadata = {
  title: "SYNNR — Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <div className="dash" dangerouslySetInnerHTML={{ __html: DASHBOARD_HTML }} />
      <DashboardScripts />
    </>
  );
}
