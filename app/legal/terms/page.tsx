import { LegalShell } from "../LegalShell";

// NOTE: marketing-site legal pages ONLY — plain-language terms for the public
// website + the free Readiness Call. The actual client service agreement (scope,
// fees, data handling, liability for a paid engagement) is a separate document
// and MUST be reviewed by an attorney before the first paid deal.

export const metadata = { title: "SYNNR — Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="June 23, 2026">
      <h2>1. About these terms</h2>
      <p>
        These terms cover your use of this website and the free Readiness Call you can
        request through it. SYNNR (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
        is operated by Darkstar Dynamics LLC. Any paid work is governed by a separate
        written service agreement — these website terms do not create one.
      </p>

      <h2>2. What SYNNR is</h2>
      <p>
        SYNNR is a <strong>done-for-you operations service</strong> for oilfield and
        blue-collar service shops. We find where a shop&apos;s jobs leak money, build a
        system that stops it — tied to that shop&apos;s real jobs, specs, and rate sheets —
        and then <strong>run that system for them on an ongoing basis</strong>. We sell an
        operations outcome and a managed service, not a software product or a self-serve
        login.
      </p>

      <h2>3. The Readiness Call</h2>
      <p>
        The Readiness Call is a free, no-obligation conversation. We&apos;ll talk through how
        your shop runs and point to your biggest operational money leak. It is not advice
        you should rely on without your own judgment, and it does not obligate either side
        to anything. We&apos;ll quote any paid work separately, in writing, only if it&apos;s a fit.
      </p>

      <h2>4. Your operational data</h2>
      <ul>
        <li>If you engage us, you may share operational data — job packets, tallies, loadout lists, rate sheets, certs, and similar records.</li>
        <li>You keep all rights to that data. You grant us a limited license to use it solely to deliver the service to you.</li>
        <li>A human reviews outputs; nothing is treated as final until it&apos;s checked.</li>
        <li>We do not sell your data and do not use it to train shared or third-party models.</li>
        <li>You confirm you have the right to share the records you give us.</li>
        <li>Detailed handling, confidentiality, and security commitments live in the written service agreement.</li>
      </ul>

      <h2>5. Engagements &amp; fees</h2>
      <p>
        No pricing is offered on this website and nothing here is a purchase. Build and
        monthly run-and-support fees are scoped per shop and set out in the written
        service agreement after the Readiness Call. That agreement controls payment,
        term, and cancellation for any paid work.
      </p>

      <h2>6. Our work &amp; your responsibility</h2>
      <p>
        We provide operations support and outputs to help your shop catch misses before
        they cost money. You remain responsible for your own business decisions —
        including dispatch, billing, and what you send to a customer. Outputs are a tool
        for your team, not a substitute for your judgment.
      </p>

      <h2>7. Acceptable use of this site</h2>
      <p>
        Don&apos;t misuse this website, attempt to break it, or submit information you
        aren&apos;t authorized to share. We may decline or end any engagement at our
        discretion.
      </p>

      <h2>8. Disclaimers &amp; liability</h2>
      <p>
        This website and the free Readiness Call are provided &ldquo;as is.&rdquo; To the
        maximum extent permitted by law, SYNNR is not liable for decisions you make based
        on the website or the call. Liability for any paid engagement is addressed in the
        written service agreement.
      </p>

      <h2>9. Contact</h2>
      <p>Questions about these terms: cadencain@synnr.io.</p>
    </LegalShell>
  );
}
