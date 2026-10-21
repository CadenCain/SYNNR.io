import { describe, it, expect } from "vitest";
import { escHtml } from "../html";

describe("email text", () => {
  it("what a hand types never becomes markup in a manager's email", () => {
    expect(escHtml(`Short: <a href="https://x.example">Approve here</a> & 'more'`))
      .toBe("Short: &lt;a href=&quot;https://x.example&quot;&gt;Approve here&lt;/a&gt; &amp; &#39;more&#39;");
  });
});
