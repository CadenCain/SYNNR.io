import { requireOperator } from "@/lib/op/auth";

export default async function CrewTabStub() {
  await requireOperator();
  return <div className="op-card op-muted">Crew + crew certs coming in the next slice.</div>;
}
