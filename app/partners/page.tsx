import "../marketing.css";
import "./partners.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import PartnersForm from "./partners-form";

export const metadata = {
  title: "Partner program | SYNNR",
  description:
    "Refer an oilfield service shop to SYNNR, get paid every month for as long as they stay. Founding-partner rate for the first recert and testing shops that sign on.",
};

export default function PartnersPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="partners">
        <div className="container pt-wrap">

          {/* Head */}
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Partner program</span>
            <h1 className="h2" style={{ marginTop: 8 }}>Refer a shop, get paid every month.</h1>
            <p className="lede" style={{ marginInline: 0, maxWidth: "68ch" }}>
              You run a recert or testing shop. You&apos;re already standing in the customer&apos;s yard when the lapsed
              cert or the bad gear turns up. SYNNR is what catches that before it costs them — and here&apos;s the part
              that matters to you: <b>every alert SYNNR sends is a call to your shop.</b>{" "}&ldquo;BOP recert due in 30
              days&rdquo; means their gear comes to you on a schedule, not in a panic. Steadier work for you, no more
              5am scramble for them — and we pay you on top of it.
            </p>
          </div>

          {/* Terms */}
          <div className="pt-terms">
            <div className="pt-term">
              <span className="pt-badge">Founding-partner rate</span>
              <h3>25% of the money, every month</h3>
              <p>
                25% of recurring revenue from every shop you refer — paid monthly, for as long as that shop stays a
                customer. No cap, stacks across referrals. This rate is for our <b>first 3&ndash;5 partners only</b>;
                partners after that get a different deal. In writing, one page, before you refer anyone.
              </p>
            </div>
            <div className="pt-term">
              <span className="pt-badge alt">Or keep it simple</span>
              <h3>$500 flat per signed shop</h3>
              <p>
                Prefer cash over a monthly check? $500 flat for every shop you refer that signs on. Your choice —
                pick whichever suits how you run your business.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="pt-steps">
            <h2 className="h3">How it works</h2>
            <ol>
              <li><b>Become a partner.</b> One call. We agree your rate, put it on paper, and you get your own referral link.</li>
              <li><b>Refer a shop.</b> Next time you&apos;re on-site and find a lapsed cert or a bad piece of gear, hand them your link. That&apos;s the whole job — no pitch, no demo.</li>
              <li><b>Get paid.</b> They sign on through your link, you get paid — every month they stay active, or the flat bounty. Payout monthly, straight to you.</li>
            </ol>
            <p className="muted pt-note">
              Your link tags every shop that signs up through it, so there&apos;s never a question about whose referral
              it was. Straight answer on where we are: SYNNR is onboarding its first shops now — you&apos;d be a founding
              partner in the truest sense.
            </p>
          </div>

          {/* CTA + contact */}
          <div className="pt-cta-row">
            <div className="pt-card">
              <h2 className="h3">Become a partner</h2>
              <PartnersForm />
            </div>
            <div className="pt-contact">
              <h3>Rather just talk?</h3>
              <p>Call or text Caden — he answers.</p>
              <a className="pt-phone" href="tel:4322500715">432-250-0715</a>
              <a className="pt-mail" href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>
            </div>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
