import { redirect } from "next/navigation";

// The trucks list became the Load out home screen (/app).
export default function TrucksMoved() {
  redirect("/app");
}
