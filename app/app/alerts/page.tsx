import { redirect } from "next/navigation";

/**
 * /app/alerts merged into /app/compliance (Compliance & Logs, 2026-08-20).
 * The redirect stays so old bookmarks, alert emails, and muscle memory keep
 * landing somewhere real instead of a 404.
 */
export default function AlertsPage() {
  redirect("/app/compliance");
}
