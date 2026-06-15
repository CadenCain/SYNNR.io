// SYNNR checkout markup (ported from the design prototype). Plan-aware text +
// card formatting + pay flow handled by CheckoutScripts (reads ?plan=).
export const CHECKOUT_HTML = `
<div class="checkout">

  <aside class="sumcol">
    <div class="sumin">
      <a class="back" href="/#pricing"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Back to pricing</a>
      <div class="brand"><span class="mk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z"/></svg></span><b>SYNNR</b></div>

      <div class="sub-label">Subscribe to <span id="planName">TallyShot — Pro</span></div>
      <div class="price-big"><span class="amt" id="priceBig">$199.00</span><span class="per">per month</span></div>
      <div class="billed" id="billed">Billed monthly · cancel anytime</div>

      <div class="lines">
        <div class="lrow">
          <div class="ln"><b id="liName">TallyShot — Pro</b><span id="liDesc">Multi-crew · unlimited sheets</span></div>
          <div class="lv" id="liPrice">$199.00</div>
        </div>
        <div class="lrow sub"><div class="ln"><b>Tally sheet → clean Excel</b></div><div class="lv">Included</div></div>
        <div class="lrow sub"><div class="ln"><b>Subtotal</b></div><div class="lv" id="subtotal">$199.00</div></div>
        <div class="lrow total"><div class="ln"><b>Total due today</b></div><div class="lv" id="total">$199.00</div></div>
      </div>

      <div class="guarantee">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
        <p><b>Month to month. Cancel anytime.</b> No long-term contract — your plan renews monthly and you can cancel from your dashboard, effective at the end of the period.</p>
      </div>
    </div>
  </aside>

  <main class="paycol">
    <div class="payin">
      <div class="pay-h">Pay with card</div>
      <div class="testhint">Demo — enter any details (e.g. 4242 4242 4242 4242)</div>

      <div class="field">
        <label>Email</label>
        <input class="inp" id="email" type="email" placeholder="ray@company.com" autocomplete="email" />
      </div>

      <div class="field">
        <label>Card information</label>
        <div class="cardbox" id="cardbox">
          <div class="crow num">
            <input id="cardNum" inputmode="numeric" placeholder="1234 1234 1234 1234" maxlength="23" autocomplete="cc-number" />
            <span class="brandtag" id="brandTag"></span>
          </div>
          <div class="split">
            <div class="crow exp"><input id="cardExp" inputmode="numeric" placeholder="MM / YY" maxlength="7" autocomplete="cc-exp" /></div>
            <div class="crow cvc"><input id="cardCvc" inputmode="numeric" placeholder="CVC" maxlength="4" autocomplete="cc-csc" /></div>
          </div>
        </div>
      </div>

      <div class="field">
        <label>Name on card</label>
        <input class="inp" id="cardName" placeholder="Ray Mendez" autocomplete="cc-name" />
      </div>

      <div class="field">
        <label>Billing country</label>
        <select class="inp" id="country">
          <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Australia</option><option>Other</option>
        </select>
      </div>

      <button class="paybtn" id="payBtn">Subscribe · <span id="btnAmt">$199.00</span>/mo</button>
      <div class="err" id="err"></div>

      <div class="secline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Payments are encrypted &amp; secure</div>
      <div class="pstripe">Powered by <b>stripe</b></div>
      <div class="terms">By subscribing, you agree to SYNNR's <a href="/legal/terms">Terms</a> and <a href="/legal/privacy">Privacy Policy</a>. You can cancel anytime.</div>
    </div>
  </main>
</div>

<div class="done-overlay" id="doneOverlay">
  <div class="done-card">
    <div class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6 9 17l-5-5"/></svg></div>
    <h2>You're subscribed to SYNNR</h2>
    <p>Your workspace is active. Start scanning tally sheets — clean Excel out the other side.</p>
    <div class="meta"><span id="doneName">TallyShot — Pro</span><span id="doneAmt">$199.00 / mo</span></div>
    <a class="gobtn" href="/dashboard">Go to dashboard<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
  </div>
</div>
`;
