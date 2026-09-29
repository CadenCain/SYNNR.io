import { describe, it, expect } from "vitest";
import { verifyUpload, nameOnPaper, identifierOnPaper, titleKeywords, type VerifyInput } from "../cert-verify";
import { findDates, normalizeOcr, paperHasDate, pickExpiration } from "../cert-dates";

/**
 * The photo checks. The point: a hand can't get a truck green with a date
 * that isn't on the paper, somebody else's card, the wrong cert, or a photo
 * that already cleared something else.
 */

const TODAY = "2026-09-28";
const BOP_CERT = `PERMIAN PRESSURE TESTING LLC
CERTIFICATE OF PRESSURE TEST - BOP
Equipment: Quad BOP stack   Serial No: QB-4471
Test pressure: 10,000 psi   Held 15 min
Date tested: 09/26/2026
Expires: 03/26/2027
Inspector: R. Salinas   Cert #88213`;

const H2S_CARD = `H2S CLEAR - ANSI Z390.1
This certifies that KEVIN ODOM
has completed H2S Awareness training
Issued 08/14/2026   Expires 08/14/2027`;

const base = (over: Partial<VerifyInput> = {}): VerifyInput => ({
  evidence: "cert",
  claimedExpiration: "2027-03-26",
  today: TODAY,
  readText: BOP_CERT,
  itemTitle: "BOP pressure test",
  holderName: null,
  identifier: "QB-4471",
  prevExpiration: "2026-09-23",
  itemWasFailing: true,
  claimedIssued: null,
  sameHashOn: [],
  ...over,
});

describe("reading dates off paper", () => {
  it("finds US, ISO, and spelled-out dates", () => {
    const d = findDates("Tested 09/26/2026. Due 2027-03-26. Next: June 15, 2027. Exp 15 Jun 2028").map((x) => x.iso).sort();
    expect(d).toEqual(["2026-09-26", "2027-03-26", "2027-06-15", "2028-06-15"]);
  });
  it("fixes OCR letter/digit swaps inside dates only", () => {
    expect(normalizeOcr("Expires: O3/26/2O27")).toContain("03/26/2027");
    expect(normalizeOcr("BOP stack")).toBe("BOP stack");
  });
  it("month-only cards (EXP 03/2027) match any day that month", () => {
    const f = findDates("EXP 03/2027");
    expect(paperHasDate(f, "2027-03-15")).toBe(true);
    expect(paperHasDate(f, "2027-04-15")).toBe(false);
  });
  it("'15 June 2027' is a day, not a month-only date", () => {
    const f = findDates("Expires 15 June 2027");
    expect(f.find((x) => x.iso === "2027-06-30")).toBeUndefined();
    expect(pickExpiration(f.map((x) => x.iso), TODAY)).toBe("2027-06-15");
  });
});

describe("the name and serial checks", () => {
  it("finds the last name, forgiving one letter of OCR slop on long names", () => {
    expect(nameOnPaper("Kevin Odom", H2S_CARD).ok).toBe(true);
    expect(nameOnPaper("Dewayne Sparks", "DEWAYNE SPARKES").ok).toBe(true);
    expect(nameOnPaper("Kevin Odom", "LOGAN MCAFEE").ok).toBe(false);
  });
  it("short names must match exactly (no 'Odom' ≈ 'Odum')", () => {
    expect(nameOnPaper("Kevin Odom", "KEVIN ODUM").ok).toBe(false);
  });
  it("serials compare with dashes and spaces stripped", () => {
    expect(identifierOnPaper("QB-4471", "Serial No: QB 4471")).toBe(true);
    expect(identifierOnPaper("QB-4471", "Serial No: QB-4417")).toBe(false);
  });
  it("title keywords skip generic words", () => {
    expect(titleKeywords("BOP pressure test")).toEqual(["bop", "pressure"]);
    expect(titleKeywords("Annual DOT inspection")).toEqual(["dot"]);
  });
});

describe("verifyUpload — what goes green by itself", () => {
  it("the real cert, right date, right serial → verified", () => {
    const v = verifyUpload(base());
    expect(v.reject).toBeNull();
    expect(v.verdict).toBe("verified");
    expect(v.checks.every((c) => c.ok)).toBe(true);
    expect(v.issued).toBe("2026-09-26");
  });

  it("a date that isn't on the paper → waits on a manager, says which dates were there", () => {
    const v = verifyUpload(base({ claimedExpiration: "2027-09-26" }));
    expect(v.verdict).toBe("needs_review");
    const date = v.checks.find((c) => c.key === "date")!;
    expect(date.ok).toBe(false);
    expect(date.detail).toContain("09/26/2027");
    expect(date.detail).toContain("03/26/2027");
  });

  it("typed date exactly a year out and not on the paper → flagged as possible made-up", () => {
    const v = verifyUpload(base({ claimedExpiration: "2027-09-28" }));
    expect(v.flags.join(" ")).toContain("exactly 1 year");
  });

  it("the same round date IS fine when it's printed on the paper", () => {
    const v = verifyUpload(base({ readText: BOP_CERT.replace("03/26/2027", "09/28/2027"), claimedExpiration: "2027-09-28" }));
    expect(v.flags).toHaveLength(0);
    expect(v.verdict).toBe("verified");
  });

  it("someone else's card → waits on a manager", () => {
    const v = verifyUpload(base({ readText: H2S_CARD, itemTitle: "H2S Clear", identifier: null, holderName: "Logan McAfee", claimedExpiration: "2027-08-14" }));
    expect(v.verdict).toBe("needs_review");
    expect(v.checks.find((c) => c.key === "name")!.ok).toBe(false);
  });

  it("the hand's own card → verified", () => {
    const v = verifyUpload(base({ readText: H2S_CARD, itemTitle: "H2S Clear", identifier: null, holderName: "Kevin Odom", claimedExpiration: "2027-08-14" }));
    expect(v.verdict).toBe("verified");
  });

  it("a lubricator cert can't clear a BOP item", () => {
    const lube = BOP_CERT.replace(/BOP/g, "LUBRICATOR").replace("Quad BOP stack", "Lubricator").replace("PRESSURE TEST", "INSPECTION");
    const v = verifyUpload(base({ readText: lube, identifier: null, itemTitle: "BOP test" }));
    expect(v.checks.find((c) => c.key === "type")!.ok).toBe(false);
    expect(v.verdict).toBe("needs_review");
  });

  it("a different serial → waits on a manager", () => {
    const v = verifyUpload(base({ identifier: "QB-9001" }));
    expect(v.verdict).toBe("needs_review");
  });

  it("a photo already used on another item → waits, and it's flagged", () => {
    const v = verifyUpload(base({ sameHashOn: ["BOP pressure test (Spare dual BOP stack)"] }));
    expect(v.verdict).toBe("needs_review");
    expect(v.flags.join(" ")).toContain("Same photo");
  });

  it("backdated: it lapsed, then showed up dated before the lapse → flagged", () => {
    const v = verifyUpload(base({ readText: BOP_CERT.replace("09/26/2026", "09/20/2026") }));
    expect(v.flags.join(" ")).toContain("Worth a look");
  });
});

describe("verifyUpload — refused outright (nothing saved)", () => {
  it("an old date", () => {
    expect(verifyUpload(base({ claimedExpiration: "2026-09-01" })).reject).toContain("isn't in the future");
  });
  it("today's date", () => {
    expect(verifyUpload(base({ claimedExpiration: TODAY })).reject).toContain("isn't in the future");
  });
  it("more than ten years out", () => {
    expect(verifyUpload(base({ claimedExpiration: "2040-01-01" })).reject).toContain("10 years");
  });
  it("an unreadable photo → retake, with the option to send it to a manager anyway", () => {
    const v = verifyUpload(base({ readText: "~~ ::" }));
    expect(v.reject).toContain("Retake");
    expect(v.canForce).toBe(true);
  });
  it("the server couldn't read it at all → same: retake or send to a manager", () => {
    const v = verifyUpload(base({ readText: null }));
    expect(v.reject).toContain("Retake");
    expect(v.canForce).toBe(true);
  });
});

describe("cert on the way (retest invoice or tag)", () => {
  it("never verifies by itself: a manager always looks", () => {
    const v = verifyUpload(base({ evidence: "temporary", claimedExpiration: null, readText: "INVOICE Permian Pressure Testing BOP retest 09/27/2026 $1,850.00 paid" }));
    expect(v.reject).toBeNull();
    expect(v.verdict).toBe("needs_review");
  });
  it("a handwritten tag that can't be read isn't refused (a manager looks at it)", () => {
    const v = verifyUpload(base({ evidence: "temporary", claimedExpiration: null, readText: "" }));
    expect(v.reject).toBeNull();
    expect(v.verdict).toBe("needs_review");
  });
});
