import "./marketing.css";
import { MARKETING_HTML } from "./marketing-html";
import MarketingScripts from "./marketing-scripts";

export default function Home() {
  return (
    <>
      <div className="mkt" dangerouslySetInnerHTML={{ __html: MARKETING_HTML }} />
      <MarketingScripts />
    </>
  );
}
