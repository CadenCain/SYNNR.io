import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../notify", () => ({ sendEmail: vi.fn(async () => true) }));
import { sendEmail } from "../notify";
import { sendPasswordReset, resetLink, resetEmailHtml, emailHash } from "../password-reset";

/** A fake service-role client: `recent` resets already sent to this address in the last hour. */
function fakeAdmin({ recent = 0, user = true }: { recent?: number; user?: boolean } = {}) {
  const inserted: unknown[] = [];
  const generateLink = vi.fn(async () => user
    ? { data: { properties: { hashed_token: "abc123" }, user: { user_metadata: { full_name: "Freddy Carrasco" } } }, error: null }
    : { data: { properties: null, user: null }, error: { message: "User not found" } });
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: recent }) }) }),
      insert: async (row: unknown) => { inserted.push(row); return { error: null }; },
    }),
    auth: { admin: { generateLink } },
  };
  return { admin: admin as never, inserted, generateLink };
}

describe("password reset email", () => {
  beforeEach(() => vi.mocked(sendEmail).mockClear());

  it("sends a link that works on any device, from the site's own address", async () => {
    const { admin, generateLink } = fakeAdmin();
    expect(await sendPasswordReset(admin, "  Freddy@Example.com ")).toBe("sent");
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: "freddy@example.com" });
    const [to, , html] = vi.mocked(sendEmail).mock.calls[0];
    expect(to).toEqual(["freddy@example.com"]);
    expect(html).toContain("https://www.synnr.io/auth/confirm?token_hash=abc123&amp;type=recovery");
    expect(html).toContain("Hi Freddy,");
  });

  it("stops at three an hour to one address", async () => {
    const { admin, generateLink } = fakeAdmin({ recent: 3 });
    expect(await sendPasswordReset(admin, "freddy@example.com")).toBe("skipped");
    expect(generateLink).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing for an email with no login, a demo login, or junk", async () => {
    expect(await sendPasswordReset(fakeAdmin({ user: false }).admin, "nobody@example.com")).toBe("skipped");
    expect(await sendPasswordReset(fakeAdmin().admin, "demo-123@demo.synnr.io")).toBe("skipped");
    expect(await sendPasswordReset(fakeAdmin().admin, "not an email")).toBe("skipped");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps only a hash of the address, and escapes what goes in the email", () => {
    expect(emailHash(" A@B.com ")).toBe(emailHash("a@b.com"));
    expect(emailHash("a@b.com")).not.toContain("@");
    expect(resetLink("x y")).toContain("token_hash=x%20y");
    expect(resetEmailHtml("https://x", "<b>Bo</b> Duke")).toContain("Hi &lt;b&gt;Bo&lt;/b&gt;,");
  });
});
