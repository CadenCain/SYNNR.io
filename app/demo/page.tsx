import { redirect } from "next/navigation";

// The interactive TallyShot demo lives at /ingest now; keep /demo as an alias.
export default function DemoPage() {
  redirect("/ingest");
}
