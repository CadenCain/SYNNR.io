import "./onboarding.css";
import { ONBOARDING_HTML } from "./onboarding-html";
import OnboardingScripts from "./onboarding-scripts";

export const metadata = {
  title: "SYNNR — Get started",
};

export default function OnboardingPage() {
  return (
    <>
      <div className="ob" dangerouslySetInnerHTML={{ __html: ONBOARDING_HTML }} />
      <OnboardingScripts />
    </>
  );
}
