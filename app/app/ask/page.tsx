import { redirect } from "next/navigation";

/** Ask is the home screen now. Old links land there. */
export default function AskPage() {
  redirect("/app");
}
