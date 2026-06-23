import { redirect } from "next/navigation";

// Old "Custom Builds" pricing page is retired — the whole site is the service now.
export default function Services() {
  redirect("/readiness-map");
}
