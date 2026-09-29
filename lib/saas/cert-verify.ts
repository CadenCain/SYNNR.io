import { findDates, paperHasDate, usDate, type FoundDate } from "./cert-dates";
import { addDaysIso } from "./status";

/**
 * Checking a cert photo against what the hand typed. Pure: the server reads
 * the photo (lib/saas/cert-read.ts) and hands the text here.
 *
 * No AI. The software proves the parts it can prove from the paper itself:
 *   · it could read the photo at all
 *   · the expiration typed in is printed on the paper
 *   · the hand's name is on their card / the serial is on the gear's cert
 *   · the paper is about the right thing (a lubricator cert can't clear a BOP)
 *   · this exact photo hasn't already cleared something else
 * Everything that passes goes green. Anything that doesn't goes to a manager
 * with the exact reason, and the item stays red until a manager says yes.
 */

export type Evidence = "cert" | "temporary";

export interface VerifyInput {
  evidence: Evidence;
  claimedExpiration: string | null; // required for a cert
  today: string;
  readText: string | null;          // null = the server couldn't read the photo
  itemTitle: string;
  holderName: string | null;        // crew cards: whose card this is
  identifier: string | null;        // serial / unit number on file, if any
  prevExpiration: string | null;
  itemWasFailing: boolean;          // expired or no date when the upload came in
  claimedIssued: string | null;
  sameHashOn: string[];             // other items this exact photo already went on
}

export interface Check { key: string; label: string; ok: boolean; detail: string }

export interface Verification {
  /** Nothing is saved; the hand sees this and retakes. */
  reject: string | null;
  /** A reject the hand may push to a manager anyway (an unreadable tag, say). */
  canForce: boolean;
  verdict: "verified" | "needs_review";
  checks: Check[];
  flags: string[];
  readDates: string[];
  issued: string | null;
}

const GENERIC = new Set([
  "test", "tests", "testing", "inspection", "inspections", "inspected", "annual", "cert", "certs", "certificate",
  "certification", "card", "cards", "the", "and", "for", "with", "new", "service", "services", "check", "report",
  "stack", "unit", "truck", "clear", "renewal", "renewed", "yearly", "monthly", "set", "kit",
]);

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Distinctive words in an item title: "BOP pressure test" → bop, pressure. */
export function titleKeywords(title: string): string[] {
  return [...new Set(words(title).filter((w) => w.length >= 3 && !GENERIC.has(w) && !/^\d+$/.test(w)))];
}

/** Edit distance ≤ 1: OCR drops or swaps one letter in a name all the time. */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Is this name on the card? The last name has to be there; one letter of OCR slop is forgiven on longer names. */
export function nameOnPaper(name: string, text: string): { ok: boolean; looked: string } {
  const parts = words(name).filter((w) => w.length >= 2 && !["jr", "sr", "ii", "iii"].includes(w));
  const last = parts[parts.length - 1] ?? "";
  if (!last) return { ok: true, looked: "" };
  const onPage = words(text);
  const ok = onPage.some((w) => (last.length >= 5 ? nearlyEqual(w, last) : w === last));
  return { ok, looked: last };
}

/** Is this serial / unit number on the paper? Compared with spaces and dashes stripped. */
export function identifierOnPaper(identifier: string, text: string): boolean {
  const want = alnum(identifier);
  if (want.length < 3) return true; // too short to mean anything
  return alnum(text).includes(want);
}

const ROUND_DAYS = [90, 180, 182, 183, 184, 365, 366, 730, 731, 1095, 1096];

export function verifyUpload(v: VerifyInput): Verification {
  const checks: Check[] = [];
  const flags: string[] = [];
  const found: FoundDate[] = v.readText ? findDates(v.readText) : [];
  const readDates = found.map((f) => f.iso);
  const empty = (reject: string | null, canForce = false): Verification =>
    ({ reject, canForce, verdict: "needs_review", checks, flags, readDates, issued: null });

  if (v.evidence === "cert") {
    const exp = v.claimedExpiration;
    if (!exp) return empty("Enter the expiration date printed on the new cert.");
    if (exp <= v.today) return empty("That date isn't in the future. Upload the new cert, not the old one.");
    if (exp > addDaysIso(v.today, 365 * 10)) return empty("That date is more than 10 years out. Check it against the paper.");
  }

  // Could the server read it at all? A cert that can't be read gets retaken.
  // A tag or an invoice for "cert on the way" is often handwritten, so an
  // unreadable one of those just goes to a manager.
  const meaningful = (v.readText ?? "").replace(/[^A-Za-z0-9]/g, "");
  const readable = meaningful.length >= 25;
  checks.push({
    key: "readable", label: "Photo is readable", ok: readable,
    detail: readable ? "Read it clearly" : v.readText === null ? "The photo couldn't be read" : "Too little text came off the photo",
  });
  if (!readable && v.evidence === "cert") {
    return {
      ...empty("Couldn't read the photo. Retake it flat, close, and in good light, with the whole page in the frame.", true),
      checks,
    };
  }

  // The expiration typed in must be printed on the paper.
  let issued = v.claimedIssued;
  if (v.evidence === "cert" && v.claimedExpiration) {
    const onPaper = paperHasDate(found, v.claimedExpiration);
    const others = readDates.filter((d) => d !== v.claimedExpiration).slice(0, 4).map(usDate);
    checks.push({
      key: "date", label: "Expiration is on the paper", ok: onPaper,
      detail: onPaper
        ? `Found ${usDate(v.claimedExpiration)} on the photo`
        : `Couldn't find ${usDate(v.claimedExpiration)} on the photo${others.length ? `. Dates on it: ${others.join(", ")}` : ""}`,
    });
    // The test/issue date: what was typed, else the latest date on the paper
    // that's on or before today and before the expiration.
    if (!issued) {
      const cands = readDates.filter((d) => d <= v.today && d < (v.claimedExpiration as string)).sort();
      issued = cands.length ? cands[cands.length - 1] : null;
    }
    if (!onPaper) {
      const span = Math.round((Date.parse(`${v.claimedExpiration}T12:00:00Z`) - Date.parse(`${v.today}T12:00:00Z`)) / 86400e3);
      if (ROUND_DAYS.includes(span)) {
        flags.push(`The date typed in is exactly ${span >= 700 ? `${Math.round(span / 365)} years` : span >= 360 ? "1 year" : span >= 170 ? "6 months" : "90 days"} from the upload day, and it isn't on the photo.`);
      }
    }
  }

  // Whose card / which piece of gear.
  if (v.holderName) {
    const n = nameOnPaper(v.holderName, v.readText ?? "");
    if (n.looked) {
      checks.push({
        key: "name", label: "Name is on the card", ok: n.ok,
        detail: n.ok ? `Found "${n.looked}" on it` : `Couldn't find "${n.looked}" on it. Make sure it's ${v.holderName}'s card.`,
      });
    }
  }
  if (v.identifier) {
    const ok = identifierOnPaper(v.identifier, v.readText ?? "");
    checks.push({
      key: "serial", label: "Serial or unit number matches", ok,
      detail: ok ? `Found ${v.identifier} on it` : `Couldn't find ${v.identifier} on it. Make sure it's the cert for this piece.`,
    });
  }

  // Right kind of paper: the item's distinctive words should show up.
  const kws = titleKeywords(v.itemTitle);
  if (kws.length > 0 && v.evidence === "cert") {
    const page = new Set(words(v.readText ?? ""));
    const pageFlat = alnum(v.readText ?? "");
    const hit = kws.filter((k) => page.has(k) || (k.length >= 4 && pageFlat.includes(k)));
    checks.push({
      key: "type", label: "Right kind of cert", ok: hit.length > 0,
      detail: hit.length > 0 ? `It mentions ${hit.join(", ")}` : `It doesn't mention ${kws.join(" or ")}. Make sure it's the right cert.`,
    });
  }

  // The same photo can't clear two different things.
  if (v.sameHashOn.length > 0) {
    checks.push({
      key: "reused", label: "Photo not used before", ok: false,
      detail: `This exact photo was already uploaded for ${v.sameHashOn.slice(0, 2).join(" and ")}`,
    });
    flags.push(`Same photo used for ${v.sameHashOn.slice(0, 2).join(" and ")}.`);
  }

  // Backdated: it lapsed, then showed up with a test dated before the old one ran out.
  if (v.evidence === "cert" && v.itemWasFailing && issued && v.prevExpiration && issued < v.prevExpiration) {
    flags.push(`It lapsed ${usDate(v.prevExpiration)}, but the new paper is dated ${usDate(issued)}, before that. Worth a look.`);
  }

  const allOk = checks.every((c) => c.ok);
  // Temporary evidence is never "verified" by the software: an invoice or a
  // tag says a retest happened, not what the cert will say.
  const verdict = v.evidence === "cert" && allOk ? "verified" : "needs_review";
  return { reject: null, canForce: false, verdict, checks, flags, readDates, issued };
}
