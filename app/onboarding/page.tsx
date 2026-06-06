import { redirect } from "next/navigation";
import "./onboarding.css";
import { ONBOARDING_HTML } from "./onboarding-html";
import OnboardingScripts from "./onboarding-scripts";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "SYNNR — Get started",
};

export default async function OnboardingPage() {
  // Onboarding creates a real workspace, so it requires sign-in.
  // (If Supabase env isn't configured the gate is skipped so the demo still runs.)
  const supabase = await getServerSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login?next=/onboarding");
  }

  return (
    <>
      <div className="ob" dangerouslySetInnerHTML={{ __html: ONBOARDING_HTML }} />
      <OnboardingScripts />
    </>
  );
}
