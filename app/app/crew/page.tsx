import { redirect } from "next/navigation";

// SYNNR tracks equipment only. Crew cards were retired from the product on
// 2026-09-29; the records stay in the database, the pages send you home.
// The old page is in git history (app/app/crew/page.tsx before this change).
export default function CrewRetired() {
  redirect("/app");
}
