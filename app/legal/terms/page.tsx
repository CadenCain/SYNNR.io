import { LegalShell } from "../LegalShell";

export const metadata = { title: "SYNNR — Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="June 6, 2026">
      <h2>1. Agreement</h2>
      <p>
        These Terms govern your access to and use of SYNNR (&ldquo;SYNNR,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;), the field-operations readiness platform
        for service companies. By creating a workspace or using the service, you
        agree to these Terms on behalf of your organization.
      </p>

      <h2>2. The service</h2>
      <p>
        SYNNR ingests operational data you provide — loadout lists, crew
        certifications, job packets, tickets, photos, customer requirements,
        and billing rules — and checks them to surface readiness gaps,
        documentation gaps, and billable work at risk. SYNNR provides analysis
        and recommendations; you remain responsible for reviewing and approving
        any finding before acting on it or billing a customer.
      </p>

      <h2>3. Your data</h2>
      <ul>
        <li>You retain all rights to the data you upload or connect.</li>
        <li>You grant SYNNR a limited license to process that data solely to provide the service to you.</li>
        <li>We do not use your data to train shared or third-party models.</li>
        <li>You are responsible for having the rights to share the data you provide.</li>
      </ul>

      <h2>4. Plans &amp; billing</h2>
      <p>
        Paid plans are flat monthly subscriptions billed in advance on the cycle
        shown at checkout. There is no free trial and no performance or
        percentage-of-recovery fee. You may cancel at any time, effective at the
        end of the current billing period; amounts already billed are
        non-refundable except where required by law.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        You agree not to misuse the service, reverse-engineer it, or upload data
        you are not authorized to share. We may suspend access for conduct that
        risks the security or integrity of the platform.
      </p>

      <h2>6. Disclaimers &amp; liability</h2>
      <p>
        SYNNR is provided &ldquo;as is.&rdquo; Findings are estimates that
        require human review; we are not liable for billing decisions you make.
        To the maximum extent permitted by law, our aggregate liability is
        limited to the fees you paid in the prior twelve months.
      </p>

      <h2>7. Contact</h2>
      <p>Questions about these Terms: legal@synnr.io.</p>
    </LegalShell>
  );
}
