import { LegalShell } from "../LegalShell";

// Plain-language terms for SYNNR. Brought in line with the product on
// 2026-11-12: job lists, a checklist with photo proof, READY or NOT READY, a
// link a crew can send a customer, and what's proven after the job. (The
// 2026-11-09 version described answering questions from documents, which
// isn't built.) NOT reviewed by a lawyer.
//
// LAWYER FLAGS (get real counsel before serious revenue):
//  - Entity name: Darkstar Dynamics LLC, confirmed by Caden 2026-11-09.
//  - §2: "READY means your crew marked it loaded; SYNNR doesn't inspect
//    anything" is the load-bearing wall of this document. When an AI starts
//    looking at the photos, §2 has to say so, and say it can be wrong.
//  - §3: pricing isn't published while access is by invitation. Once a price
//    is public, state it here.
//  - Liability cap + disclaimer wording (§6-7).
//  - Governing law / venue (§10) and whether Texas arbitration is preferred.
//  - Data-retention window after cancellation (§4).

const description = "The terms for using SYNNR, in plain words: what the service is and isn't, access and billing, your data, and the limits on what we promise.";
export const metadata = {
  title: "Terms of Service · SYNNR", description, alternates: { canonical: "/legal/terms" },
  openGraph: { title: "Terms of Service · SYNNR", description },
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="November 12, 2026">
      <h2>1. Who we are, what this covers</h2>
      <p>
        SYNNR (synnr.io) is owned and run by Darkstar Dynamics LLC (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). SYNNR is software a service company uses to load out for a job: the company&apos;s own
        lists of what each kind of job takes, a checklist the crew loads by with photos of the critical pieces,
        a READY or NOT READY for the truck, and what the crew proves with a photo after the job. These terms
        govern your use of the website and application at synnr.io. By creating an account or using the service
        you agree to them.
      </p>

      <h2>2. What the service is, and what it isn&apos;t</h2>
      <p>
        SYNNR builds a job&apos;s checklist from the job lists your company loads into it and from what your
        crew adds, and it keeps the record: who put each piece on the truck, when, and the photos. It is a{" "}
        <strong>record-keeping and informational tool</strong>. It is not legal, accounting, engineering, or
        safety advice, and it is not a regulatory authority or an inspection service.
      </p>
      <p>
        <strong>READY in SYNNR means your crew marked every piece on the list as loaded. It does not mean
        SYNNR checked anything.</strong> SYNNR does not inspect equipment, does not judge what is in a photo,
        and does not confirm that a piece is the right one, fit for service, or correctly rigged. SYNNR works
        from what your team gave it: if a job list is missing something, wrong, or old, the checklist will be
        too. Where SYNNR uses AI (reading a photo of a dispatch, when that is turned on for your account), what
        it reads can be wrong or incomplete, so check it before you build a job from it. You remain solely
        responsible for what goes on the truck, for how your crews do the work, for safety on location, for
        your prices and what your contracts require, and for your own regulatory compliance.
      </p>
      <p>
        <strong>A link your crew sends a customer is open to anyone who has it.</strong> It shows that one
        job&apos;s list and its photos, with first names only, until one of your managers turns it off. Who it
        is sent to is up to you.
      </p>

      <h2>3. Access and billing</h2>
      <p>
        SYNNR is in early access, and accounts are opened by invitation. The price and what it covers are
        agreed with you before you are charged anything. Paid subscriptions are billed monthly through Stripe.
      </p>
      <p>
        You can cancel anytime from Settings, Billing (&ldquo;Card, invoices, or cancel&rdquo;). Cancellation stops
        future charges at the end of the current billing period; we don&apos;t issue partial-month refunds. If a
        payment fails, Stripe retries and we keep your access open for a grace period before the account becomes
        read-only.
      </p>

      <h2>4. Your data stays yours</h2>
      <p>
        Everything you put into SYNNR (job lists, jobs, photos, and anything else your team enters) is
        yours. We don&apos;t sell it, we don&apos;t show it to other customers, and we don&apos;t use it for any
        other company. You can ask for a copy of what you loaded at any time, including after you
        cancel. If you ask us to delete your account, we delete your company&apos;s data from the live system;
        residual copies in encrypted backups age out on the backup schedule.
      </p>

      <h2>5. Acceptable use</h2>
      <p>
        Don&apos;t attempt to access another company&apos;s data, probe or overload the service,
        resell access, load material you have no right to share, or use the service for anything unlawful.
        Accounts doing so can be suspended or terminated.
      </p>

      <h2>6. No warranty</h2>
      <p>
        The service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong>{" "}
        without warranties of any kind, express or implied, including fitness for a particular
        purpose. We do not warrant that a checklist, a READY, or anything else the service reads or shows will
        be accurate or complete, that the service will be uninterrupted, that an email or a notice will arrive,
        or that any compliance, safety, or business outcome will result from its use.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent the law allows, SYNNR&apos;s total liability for any claim arising
        from the service is limited to the amount you paid us in the twelve months before the
        claim. We are not liable for indirect, incidental, or consequential damages, including
        lost profits, non-productive time, regulatory fines, or losses from relying on a checklist,
        a READY, or anything else the service showed.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can stop using the service and cancel at any time. We can suspend or terminate
        accounts that violate these terms. You can still ask for a copy of your data per §4, except where
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
