import { LegalShell } from "../LegalShell";

export const metadata = { title: "SYNNR — Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="June 6, 2026">
      <h2>1. What we collect</h2>
      <ul>
        <li><b>Account data</b> — name, work email, company, and industry you provide during onboarding.</li>
        <li><b>Job data</b> — the files and connected records you upload for analysis.</li>
        <li><b>Usage data</b> — basic, privacy-friendly product analytics to improve the service.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We use your data to operate SYNNR: to run audits, surface findings, and
        support your account. We do not sell your data, and we do not use your
        job data to train shared or third-party models.
      </p>

      <h2>3. Storage &amp; security</h2>
      <p>
        Data is encrypted in transit and at rest and stored with our
        infrastructure providers (including Supabase and Vercel). Access is
        scoped to your workspace and protected by row-level security.
      </p>

      <h2>4. Sharing</h2>
      <p>
        We share data only with subprocessors required to run the service (e.g.
        hosting, database, payments) under contract, and where required by law.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can request access to, correction of, or deletion of your data at any
        time. Deleting your workspace removes associated job data on our standard
        retention schedule.
      </p>

      <h2>6. Contact</h2>
      <p>Privacy questions or requests: privacy@synnr.io.</p>
    </LegalShell>
  );
}
