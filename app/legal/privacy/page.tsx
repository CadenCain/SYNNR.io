import { LegalShell } from "../LegalShell";

// Plain-language privacy policy covering the self-serve product (not just the
// marketing site). Rewritten 2026-08-19. Lawyer flags: retention windows,
// whether Texas/CCPA-style rights language is needed as customers grow.

export const metadata = { title: "SYNNR — Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="August 19, 2026">
      <h2>1. What we collect</h2>
      <p>
        <strong>Account data:</strong> your email, name, and company name when you sign up.{" "}
        <strong>Yard data:</strong> whatever your team enters — equipment, certification and
        inspection dates, crew names and credential dates, phone numbers you add for alert
        routing, photos you upload. <strong>Usage basics:</strong> standard server logs
        (IP, timestamps, pages) needed to run and secure the service.
      </p>

      <h2>2. What we use it for</h2>
      <p>
        To run the product: showing your yard its own records, computing readiness, and sending
        the expiration alerts you configured. We email you about your account and the service.
        We do not sell your data, rent it, or use your yard records for advertising. Crew
        information you enter is used only to show it back to your company and to route alerts
        you set up.
      </p>

      <h2>3. Where it lives</h2>
      <p>
        Data is stored with Supabase (Postgres, US region) with row-level security separating
        each company&apos;s records. The app runs on Vercel. Payments are processed by Stripe —
        we never see or store card numbers. Alert emails are delivered by Resend. Each of these
        processors handles data under their own security and privacy commitments.
      </p>

      <h2>4. Who can see it</h2>
      <p>
        Your company&apos;s data is visible to your company&apos;s users, per the roles you
        assign. If you create a shareable proof link, anyone with that link can see the
        read-only status page it points to until you revoke it. The operator (us) can access
        data for support and reliability work — the daily alert sweep, for example, reads
        records to send your warnings.
      </p>

      <h2>5. Export and deletion</h2>
      <p>
        Export everything as CSV from Settings at any time, in any subscription state. To
        delete your account and company data, email{" "}
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a> — we delete from the live
        system and residual copies age out of encrypted backups on the backup schedule.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use the cookies required to keep you signed in (Supabase auth session) and a
        30-day referral cookie if you arrived through a partner link. No third-party ad
        trackers.
      </p>

      <h2>7. Changes &amp; contact</h2>
      <p>
        Material changes get dated here and emailed to subscribed customers. Questions:&nbsp;
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>.
      </p>
    </LegalShell>
  );
}
