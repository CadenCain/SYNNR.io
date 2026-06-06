import "./audit.css";
import { AUDIT_HTML } from "./audit-html";
import AuditScripts from "./audit-scripts";

export const metadata = {
  title: "SYNNR — Audit · Job #RC-4821",
};

export default function AuditPage() {
  return (
    <>
      <div className="audit" dangerouslySetInnerHTML={{ __html: AUDIT_HTML }} />
      <AuditScripts />
    </>
  );
}
