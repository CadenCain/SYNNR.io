import { LegalShell } from "../LegalShell";

// NOTE: marketing-site legal pages ONLY — plain-language privacy notice for the
// public website + the free Readiness Call. The data-handling and confidentiality
// terms for a paid engagement live in the client service agreement, which MUST be
// reviewed by an attorney before the first paid deal.

export const metadata = { title: "SYNNR — Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="June 23, 2026">
      <h2>1. What we collect</h2>
      <ul>
        <li><b>Contact details</b> — the name, shop, role, email, phone, and notes you give us when you request a Readiness Call.</li>
        <li><b>Operational data (clients only)</b> — if you engage us, the job packets, tallies, loadout lists, rate sheets, certs, and similar records we need to build and run your system.</li>
        <li><b>Basic website analytics</b> — privacy-friendly usage data to understand how the site is used.</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        We use your contact details to follow up about the Readiness Call and possible
        work. For clients, we use operational data only to deliver the service to you — to
        build and run your operations system and report on what it caught. We don&apos;t sell
        your data, and we don&apos;t use it to train shared or third-party models. A person
        reviews outputs before anything is treated as final.
      </p>

      <h2>3. Storage &amp; security</h2>
      <p>
        Data is encrypted in transit and at rest and stored with reputable infrastructure
        providers. We limit access to what&apos;s needed to deliver your service. Specific
        security and confidentiality commitments for a paid engagement are set out in the
        client service agreement.
      </p>

      <h2>4. Sharing</h2>
      <p>
        We share data only with the service providers we rely on to operate (such as
        hosting, storage, and email), under contract, and where required by law. We do not
        share your operational data with other clients.
      </p>

      <h2>5. Your choices</h2>
      <p>
        You can ask us to access, correct, or delete your information at any time. When an
        engagement ends, we return or remove your operational data on an agreed schedule.
      </p>

      <h2>6. Contact</h2>
      <p>Privacy questions or requests: cadencain@synnr.io.</p>
    </LegalShell>
  );
}
