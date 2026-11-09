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

export const metadata = { title: "Terms of Service · RollReady" };

export default function TermsPage() {
  return (
    <LegalShell eyebrow="Legal" title="Terms of Service" updated="November 9, 2026">
      <h2>1. Who we are, what this covers</h2>
      <p>
        RollReady is load-out software for oilfield service yards, made by SYNNR (&ldquo;SYNNR,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) and operated by Darkstar Dynamics LLC. These terms govern your use of the
        website and application at synnr.io. By creating an account or using the service you agree to them.
      </p>

      <h2>2. What the service is, and what it isn&apos;t</h2>
      <p>
        RollReady keeps a record of your yard&apos;s trucks, iron, tools, tests, and certs, checks each load-out
        against the records your team keeps in it, and keeps a record of who loaded, signed out, and checked in
        what. It is an <strong>informational record-keeping tool</strong>. It is not a regulatory authority, a
        certification body, an inspection service, or legal advice.
      </p>
      <p>
        <strong>You remain solely responsible for your own regulatory compliance and for what leaves your yard.</strong>{" "}
        RollReady works from the records, photos, and taps your team enters. If a record is missing, wrong, or
        stale, or a hand confirms something that isn&apos;t true, the software&apos;s answer will be wrong too. A READY
        in RollReady does not mean a truck, a piece of iron, or a crew is compliant with DOT, OSHA, operator
        requirements, or any other rule. It means the records you gave us check out. Verify against the actual
        iron and source documents before relying on anything for a safety or regulatory decision.
      </p>

      <h2>3. Subscriptions and billing</h2>
      <p>
        The service is billed monthly through Stripe at the published price per yard ($500 a yard a month
        today). You choose how many yards you pay for when you sign up, and you change that number under
        Settings, Billing. Changes are prorated by Stripe. Deleting a yard in the app does not change your bill;
        lowering the number of yards you pay for does. The demo yard is never billed. The minimum is one yard.
      </p>
      <p>
        Setup is your choice. You can load your yard yourself at no charge. If you ask us to load it for you,
        setup is $1,000 per yard, one time, billed by invoice before we start, and free for the first 10 yards
        we set up. We&apos;ll tell you the total before we do any work.
      </p>
      <p>
        You can cancel anytime from Settings, Billing (&ldquo;Card, invoices, or cancel&rdquo;). Cancellation stops
        future charges at the end of the current billing period; we don&apos;t issue partial-month refunds. If a
        payment fails, Stripe retries and we keep your access open for a grace period before the account becomes
        read-only.
      </p>

      <h2>4. Your data stays yours</h2>
      <p>
        Everything you put into RollReady (yards, trucks, equipment, tests, certs, load-out and check-in records,
        photos) is yours. You can export your records as spreadsheets at any time, in any subscription state,
        including after cancellation, and open the cert photo behind any test from its piece&apos;s page. A canceled
        account keeps read and export access. If you ask us to delete your account, we delete your company&apos;s
        data from the live system; residual copies in encrypted backups age out on the backup schedule.
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
        claim. We are not liable for indirect, incidental, or consequential damages, including
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
