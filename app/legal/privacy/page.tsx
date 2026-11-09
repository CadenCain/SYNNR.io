import { LegalShell } from "../LegalShell";

// Plain-language privacy policy covering the self-serve product (not just the
// marketing site). Rewritten 2026-08-19. Lawyer flags: retention windows,
// whether Texas/CCPA-style rights language is needed as customers grow.

export const metadata = { title: "Privacy Policy · SYNNR" };

export default function PrivacyPage() {
  return (
    <LegalShell eyebrow="Legal" title="Privacy Policy" updated="November 9, 2026">
      <p>
        SYNNR (synnr.io) is owned and run by Darkstar Dynamics LLC (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). This covers the website and RollReady, SYNNR&apos;s load-out software.
      </p>

      <h2>1. What we collect</h2>
      <p>
        <strong>Account data:</strong> your email, name, and company name when you sign up.{" "}
        <strong>Yard data:</strong> whatever your team enters: trucks, iron and tools, test dates and
        cert photos, load-out, sign-out, and check-in records with the name of who did each one,
        photos of loaded trucks, crew names, and phone numbers you add for alerts. <strong>Usage basics:</strong> standard server logs
        (IP, timestamps, pages) needed to run and secure the service.
      </p>

      <h2>2. What we use it for</h2>
      <p>
        To run the product: showing your yard its own records, checking load-outs, and sending
        the alerts and morning summaries you get. We email you about your account and the service.
        We do not sell your data, rent it, or use your yard records for advertising. Crew
        information you enter is used only to show it back to your company and to route alerts
        you set up.
      </p>

      <h2>3. Where it lives</h2>
      <p>
        Data is stored with Supabase (Postgres, US region) with row-level security separating
        each company&apos;s records. The app runs on Vercel. Payments are processed by Stripe;
        we never see or store card numbers. Alert emails are delivered by Resend. Each of these
        processors handles data under their own security and privacy commitments.
      </p>

      <h2>4. Who can see it</h2>
      <p>
        Your company&apos;s data is visible to your company&apos;s users, per the roles you
        assign. Every load-out makes a proof link for your operator, and you can make others. Anyone
        with a link can see the read-only record it points to (the iron, its certs, who loaded
        it, the photo of the truck) until you shut it off under Settings, Proof links. We can
        access data for support and reliability work; the morning summary, for example, reads
        records to send it.
      </p>

      <h2>5. Export and deletion</h2>
      <p>
        Export your records as spreadsheets at any time, in any subscription state. To delete
        your account and company data, email{" "}
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>. We delete it from the live
        system, and residual copies age out of encrypted backups on the backup schedule.
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
