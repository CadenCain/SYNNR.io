import "./checkout.css";
import { CHECKOUT_HTML } from "./checkout-html";
import CheckoutScripts from "./checkout-scripts";

export const metadata = {
  title: "SYNNR — Checkout",
};

export default function CheckoutPage() {
  return (
    <>
      <div className="co" dangerouslySetInnerHTML={{ __html: CHECKOUT_HTML }} />
      <CheckoutScripts />
    </>
  );
}
