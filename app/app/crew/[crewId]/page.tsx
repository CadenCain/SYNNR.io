import { redirect } from "next/navigation";

// Equipment only now (see app/app/crew/page.tsx).
export default function CrewMemberRetired() {
  redirect("/app");
}
