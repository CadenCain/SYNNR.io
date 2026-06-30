import "./marketing.css";
import { MARKETING_HTML } from "./marketing-html";
import MarketingScripts from "./marketing-scripts";
import MarketingFx from "./marketing-fx";

export default function Home() {
  return (
    <>
      <div className="mkt" dangerouslySetInnerHTML={{ __html: MARKETING_HTML }} />
      <MarketingScripts />
      <MarketingFx />
    </>
  );
}
