import { LegalShell } from "../LegalShell";

// Plain-language SaaS terms for the self-serve product. Rewritten 2026-08-19 —
// the prior version described the dead "done-for-you service, no self-serve
// login" pivot, the opposite of what customers now sign up for.
//
// LAWYER FLAGS (get real counsel before serious revenue):
//  - Entity name: confirm "Darkstar Dynamics LLC" is still the operating
//    entity behind the business bank account, or update it.
//  - Liability cap + disclaimer wording (§6–7) — the compliance disclaimer is
//    the load-bearing wall of this document.
//  - Governing law / venue (§10) and whether Texas arbitration is preferred.
//  - Data-retention window after cancellation (§4).

export const metadata = { title: "SYNNR — Terms of Service" };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="August 19, 2026">
      <h2>1. Who we are, what this covers</h2>
      <p>
        SYNNR (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) is software for oilfield
        service yards, operated by Darkstar Dynamics LLC. These terms govern your use of the
        SYNNR website and application at synnr.io. By creating an account or using the service
        you agree to them.
      </p>

      <h2>2. What the service is — and is not</h2>
      <p>
        SYNNR keeps a register of your yard&apos;s equipment, certifications, inspections, and
        crew credentials, and warns you before recorded items lapse. It is an
        <strong> informational record-keeping tool</strong>. It is not a regulatory authority,
        a certification body, an inspection service, or legal advice.
      </p>
      <p>
        <strong>You remain solely responsible for your own regulatory compliance.</strong>{" "}
        SYNNR works from the dates and records your team enters. If a record is missing, wrong,
        or stale, the software&apos;s output will be too. A green status in SYNNR does not mean a
        truck, tool, or person is compliant with DOT, OSHA, operator requirements, or any other
        rule — it means the records you gave us are current. Verify against source documents
        before relying on anything for a safety or regulatory decision.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <p>
        The service is billed monthly through Stripe at the published per-yard price. Your
        subscription quantity follows your count of active yards: adding a yard increases the
        next charge (prorated from the day you add it), deleting a yard decreases it the same
        way. The built-in sample/demo yard is never billed. Minimum subscription is one yard.
      </p>
      <p>
        You can cancel anytime from Settings → Billing. Cancellation stops future charges at
        the end of the current billing period; we don&apos;t issue partial-month refunds. If a
        payment fails, Stripe retries and we keep your access open for a grace period before
        the account becomes read-only.
      </p>

      <h2>4. Your data stays yours</h2>
      <p>
        Everything you put into SYNNR — yards, equipment, certs, crew records, photos — is
        yours. You can export it as CSV at any time from Settings, in any subscription state,
        including after cancellation. A canceled account keeps read and export access. If you
        ask us to delete your account, we delete your company&apos;s data from the live system;
        residual copies in encrypted backups age out on the backup schedule.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        Don&apos;t attempt to access another company&apos;s data, probe or overload the service,
        resell access, or use the service for anything unlawful. Accounts doing so can be
        suspended or terminated.
      </p>

      <h2>6. No warranty</h2>
      <p>
        The service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong>{" "}
        without warranties of any kind, express or implied, including fitness for a particular
        purpose. We do not warrant that alerts will always be delivered (email systems fail),
        that the service will be uninterrupted, or that any compliance, safety, or business
        outcome will result from its use.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent the law allows, SYNNR&apos;s total liability for any claim arising
        from the service is limited to the amount you paid us in the twelve months before the
        claim. We are not liable for indirect, incidental, or consequential damages — including
        lost profits, non-productive time, regulatory fines, or losses caused by a missed or
        undelivered alert.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can stop using the service and cancel at any time. We can suspend or terminate
        accounts that violate these terms, with export access preserved per §4 except where
        the violation involves abuse of the service itself.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms as the product evolves. Material changes will be dated at the
        top of this page and, for subscribed customers, announced by email before they take
        effect. Continued use after the effective date is acceptance.
      </p>

      <h2>10. Governing law &amp; contact</h2>
      <p>
        These terms are governed by the laws of the State of Texas. Questions:&nbsp;
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>.
      </p>
    </LegalShell>
  );
}
