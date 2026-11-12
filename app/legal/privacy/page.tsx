import { LegalShell } from "../LegalShell";

// Plain-language privacy policy for SYNNR. Brought in line with the product
// on 2026-11-12 (job lists, jobs, proof photos, customer links, the morning
// email). NOT reviewed by a lawyer. Lawyer flags: retention windows, whether
// Texas/CCPA-style rights language is needed as customers grow, and the
// AI-provider wording in §3 (keep it matched to the provider's actual data
// terms, and update it the day proof photos start going to an AI).

const description = "What SYNNR collects, what it's used for, where it's kept, who can see it, and how to get a copy or have it deleted.";
export const metadata = {
  title: "Privacy Policy · SYNNR", description, alternates: { canonical: "/legal/privacy" },
  openGraph: { title: "Privacy Policy · SYNNR", description },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="November 12, 2026">
      <p>
        SYNNR (synnr.io) is owned and run by Darkstar Dynamics LLC (&ldquo;SYNNR,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us&rdquo;). This covers the website and the SYNNR application.
      </p>

      <h2>1. What we collect</h2>
      <p>
        <strong>If you request access:</strong> your name, company, cell number, and what you tell us you
        run. <strong>Account data:</strong> your email, name, and company name.{" "}
        <strong>Company data:</strong> whatever your team loads or enters: your job lists; the jobs your
        crews run (the kind of job, the truck, job details such as the customer, the well and the sizes, and
        remarks); who put each piece on a truck and when; and the photos your crew takes as proof.{" "}
        <strong>Usage basics:</strong> standard server logs (IP, timestamps,
        pages) needed to run and secure the service.
      </p>

      <h2>2. What we use it for</h2>
      <p>
        To run the product: building your crew&apos;s checklists from your own job lists, keeping the record
        of each job, showing your managers where each truck stands, and emailing your managers in the morning
        about trucks with no photo after a job. We call or text you back if you asked for access, and we email
        you about your account and the service. We do not sell your data, rent it, or use it for advertising,
        and one company&apos;s material is never used for another company.
      </p>

      <h2>3. Where it lives</h2>
      <p>
        Data is stored with Supabase (Postgres, US region) with row-level security separating
        each company&apos;s records. The app runs on Vercel. Payments are processed by Stripe;
        we never see or store card numbers. Emails are delivered by Resend. Proof photos are kept in private
        storage with Supabase and are not sent to an AI provider. If reading a dispatch photo is turned on for
        your account, the photo you send is passed to our AI provider, Anthropic, to be read, and SYNNR does
        not keep the photo. Each of these processors handles data under their own security and privacy
        commitments.
      </p>

      <h2>4. Who can see it</h2>
      <p>
        Your company&apos;s data is visible to your company&apos;s users, per the roles you
        assign. If someone on your crew makes a link to send a customer, anyone who has that link can see that
        one job&apos;s list and its proof photos, with first names only, until one of your managers turns the
        link off. We can access data for support and reliability work.
      </p>

      <h2>5. Copies and deletion</h2>
      <p>
        To get a copy of what your company loaded, or to delete your account and company data, email{" "}
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>. We delete it from the live
        system, and residual copies age out of encrypted backups on the backup schedule.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use the cookies required to keep you signed in (Supabase auth session), one that remembers which
        company you are working in if your login is on more than one, and a 30-day referral cookie if you
        arrived through a partner link. We count page visits with Vercel Web Analytics, which does not use
        cookies; the private part of a customer link or a crew invite is blanked before a visit is counted. No
        third-party ad trackers.
      </p>

      <h2>7. Changes &amp; contact</h2>
      <p>
        Material changes get dated here and emailed to subscribed customers. Questions:&nbsp;
        <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>.
      </p>
    </LegalShell>
  );
}
