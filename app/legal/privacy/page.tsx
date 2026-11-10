import { LegalShell } from "../LegalShell";

// Plain-language privacy policy for SYNNR. Rewritten 2026-11-09 when SYNNR
// replaced RollReady. Lawyer flags: retention windows, whether Texas/CCPA-style
// rights language is needed as customers grow, and the AI-provider wording in
// §3 (keep it matched to the provider's actual data terms).

export const metadata = { title: "Privacy Policy · SYNNR" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="November 9, 2026">
      <p>
        SYNNR (synnr.io) is owned and run by Darkstar Dynamics LLC (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). This covers the website and the SYNNR application.
      </p>

      <h2>1. What we collect</h2>
      <p>
        <strong>If you request access:</strong> your name, company, cell number, and what you tell us you
        run. <strong>Account data:</strong> your email, name, and company name.{" "}
        <strong>Company data:</strong> whatever your team loads or enters: documents such as price books,
        contracts, procedures, and tickets; lists of trucks, tools, and people; photos; and the questions your
        team asks along with the answers. <strong>Usage basics:</strong> standard server logs (IP, timestamps,
        pages) needed to run and secure the service.
      </p>

      <h2>2. What we use it for</h2>
      <p>
        To run the product: answering your team&apos;s questions from your own company&apos;s material. We
        call or text you back if you asked for access, and we email you about your account and the service. We
        do not sell your data, rent it, or use it for advertising, and one company&apos;s material is never used
        to answer another company&apos;s questions.
      </p>

      <h2>3. Where it lives</h2>
      <p>
        Data is stored with Supabase (Postgres, US region) with row-level security separating
        each company&apos;s records. The app runs on Vercel. Payments are processed by Stripe;
        we never see or store card numbers. Account emails are delivered by Resend. When SYNNR answers a
        question, the question and the parts of your documents needed to answer it are sent to our AI
        provider, Anthropic, to produce the answer. Each of these processors handles data under their own
        security and privacy commitments.
      </p>

      <h2>4. Who can see it</h2>
      <p>
        Your company&apos;s data is visible to your company&apos;s users, per the roles you
        assign. A person&apos;s own chats are theirs; what the company has loaded is shared across the company.
        We can access data for support and reliability work.
      </p>

      <h2>5. Copies and deletion</h2>
      <p>
        To get a copy of what your company loaded, or to delete your account and company data, email{" "}
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>. We delete it from the live
        system, and residual copies age out of encrypted backups on the backup schedule.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use the cookies required to keep you signed in (Supabase auth session) and a
        30-day referral cookie if you arrived through a partner link. We count page visits with Vercel Web
        Analytics, which does not use cookies. No third-party ad trackers.
      </p>

      <h2>7. Changes &amp; contact</h2>
      <p>
        Material changes get dated here and emailed to subscribed customers. Questions:&nbsp;
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>.
      </p>
    </LegalShell>
  );
}
