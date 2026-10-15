import type { Metadata } from "next";
import "./marketing.css";
import { MARKETING_HTML } from "./marketing-html";
import MarketingScripts from "./marketing-scripts";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <div className="mkt" dangerouslySetInnerHTML={{ __html: MARKETING_HTML }} />
      <MarketingScripts />
    </>
  );
}
