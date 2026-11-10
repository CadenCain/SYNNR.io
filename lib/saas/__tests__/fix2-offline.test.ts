import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoadOutView from "@/app/app/_components/loadout-view";
import { readSavedMark, savedWhen } from "@/app/app/_components/offline-support";
import type { LoadOutTruckRow } from "@/lib/saas/loadout-board";

/**
 * Round 2, offline and weak signal:
 *   - a saved copy the worker shows (no signal, or one bar slower than 5
 *     seconds) is marked, so the page says it's the copy saved on this phone
 *     and when, even with signal. Last night's board never passes for live.
 *   - the board's late-plan box splits "still blocked" (scanned, NOT READY)
 *     from "hasn't been scanned out", like the morning email.
 */

const ORIGIN = "https://www.synnr.io";
const SW = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");
const BANNER = readFileSync(path.resolve(__dirname, "../../../app/app/_components/offline-support.tsx"), "utf8");

const SAVED_AT = "Mon, 09 Nov 2026 02:12:00 GMT";
const PAGE = '<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>Load out</title></head><body><main>board</main></body></html>';

type Res = { ok: boolean; redirected: boolean; type: string; url: string; status: number; statusText?: string; headers: Headers; clone(): Res; text(): Promise<string> };
const res = (body: string, over: Partial<Res> = {}, head: Record<string, string> = {}): Res => ({
  ok: true, redirected: false, type: "basic", url: `${ORIGIN}/app`, status: 200,
  headers: new Headers({ "content-type": "text/html; charset=utf-8", ...head }),
  clone: () => res(body, over, head), text: async () => body, ...over,
});

function boot(fetchImpl: (req: unknown) => Promise<Res>) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, Res>>();
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        match: async (k: string) => c.get(k),
        put: async (k: string, r: Res) => { c.set(k, r); },
        keys: async () => [...c.keys()],
        delete: async (k: string) => c.delete(k),
      };
    },
    delete: async (name: string) => store.delete(name),
    keys: async () => [...store.keys()],
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
  };
  vm.runInContext(SW, vm.createContext({ self, caches, fetch: fetchImpl, URL, Response, Headers, setTimeout, clearTimeout, Promise, console }));
  function go(pathname: string) {
    let responded: Promise<Response> | null = null;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { method: "GET", url: `${ORIGIN}${pathname}`, mode: "navigate" },
      respondWith: (p: Promise<Response>) => { responded = p; },
      waitUntil: (p: Promise<unknown>) => { waits.push(p); },
    });
    return { responded: responded as Promise<Response> | null, waits };
  }
  const save = async (k: string, r: Res) => (await caches.open("rr-pages-v1")).put(`${ORIGIN}${k}`, r);
  return { go, save };
}

function deferred() {
  let resolve!: (r: Res) => void;
  const p = new Promise<Res>((a) => { resolve = a; });
  return { p, resolve };
}

/** Just enough of a document to read the worker's mark out of a page. */
const docOf = (html: string) => ({
  querySelector: (sel: string) => {
    if (sel !== 'meta[name="rr-saved"]') return null;
    const tag = html.match(/<meta name="rr-saved"[^>]*>/)?.[0];
    if (!tag) return null;
    return { getAttribute: (n: string) => tag.match(new RegExp(`${n}="([^"]*)"`))?.[1] ?? null };
  },
}) as unknown as Pick<Document, "querySelector">;

const spaces = (s: string) => s.replace(/\s/g, " ");

describe("sw.js: a saved copy is marked as one", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("one bar, 5 seconds: the saved board shows marked with when it was saved and for which page", async () => {
    const net = deferred();
    const sw = boot(() => net.p);
    await sw.save("/app", res(PAGE, {}, { date: SAVED_AT, "content-length": "123" }));
    const { responded } = sw.go("/app");
    await vi.advanceTimersByTimeAsync(5000);
    const r = await responded!;
    const html = await r.text();
    expect(html).toContain(`<head><meta name="rr-saved" content="${Date.parse(SAVED_AT)}" data-path="/app"><meta charSet="utf-8"/>`);
    expect(html).toContain("<main>board</main>");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(r.headers.get("content-length")).toBeNull();

    // The page reads the same mark back.
    const mark = readSavedMark(docOf(html), Date.parse(SAVED_AT));
    expect(mark).toMatchObject({ path: "/app", at: Date.parse(SAVED_AT) });
    expect(mark!.when).toMatch(/^ at \d{1,2}:12\sPM$/);
  });

  it("no signal: the saved scan page is marked too", async () => {
    const sw = boot(async () => { throw new TypeError("Failed to fetch"); });
    await sw.save("/app/units/u1/scan", res(PAGE, { url: `${ORIGIN}/app/units/u1/scan` }, { date: SAVED_AT }));
    const html = await (await sw.go("/app/units/u1/scan").responded!).text();
    expect(html).toContain('data-path="/app/units/u1/scan"');
  });

  it("the live page from the network is never marked", async () => {
    const sw = boot(async () => res(PAGE, {}, { date: SAVED_AT }));
    await sw.save("/app", res(PAGE, {}, { date: SAVED_AT }));
    const html = await (await sw.go("/app").responded!).text();
    expect(html).not.toContain("rr-saved");
  });

  it("a saved copy with no Date still says it's saved (no time), and one with no <head> still gets the mark", async () => {
    const sw = boot(async () => { throw new TypeError("Failed to fetch"); });
    await sw.save("/app/return", res("<p>check-in</p>"));
    const html = await (await sw.go("/app/return").responded!).text();
    expect(html).toBe('<p>check-in</p><meta name="rr-saved" content="" data-path="/app/return">');
    expect(readSavedMark(docOf(html), Date.now())).toEqual({ path: "/app/return", at: null, when: "" });
  });

  it("with signal, a saved copy that can't be marked isn't shown: it waits on the network", async () => {
    const net = deferred();
    const sw = boot(() => net.p);
    await sw.save("/app", { ...res(PAGE), clone: () => ({ ...res(PAGE), text: () => Promise.reject(new Error("disk")) }) });
    const { responded } = sw.go("/app");
    let got: Response | null = null;
    void responded!.then((r) => { got = r; });
    await vi.advanceTimersByTimeAsync(30000);
    expect(got).toBeNull();
    net.resolve(res("<main>live board</main>"));
    await vi.advanceTimersByTimeAsync(0);
    expect(await got!.text()).toBe("<main>live board</main>");
  });

  it("the page path in the mark can't break out of the attribute", () => {
    // URL paths are percent-encoded, but the worker escapes anyway.
    expect(SW).toContain('replace(/"/g, "&quot;")');
  });
});

describe("the saved-copy banner", () => {
  it("says when: today is just the time, another day names the day", () => {
    const at = new Date(2026, 10, 8, 20, 12).getTime();
    expect(spaces(savedWhen(at, new Date(2026, 10, 8, 23, 0).getTime()))).toBe(" at 8:12 PM");
    expect(spaces(savedWhen(at, new Date(2026, 10, 9, 5, 0).getTime()))).toBe(" on Sun, Nov 8 at 8:12 PM");
    expect(savedWhen(null, at)).toBe("");
  });

  it("no mark on the page: nothing to say", () => {
    expect(readSavedMark(docOf(PAGE), Date.now())).toBeNull();
  });

  it("shows with signal too, says it's not the latest, and gets the latest (once by itself, then a button)", () => {
    expect(BANNER).toContain("Weak signal.");
    expect(BANNER).toContain("This is the copy saved on this phone{saved.when}, not the latest.");
    expect(BANNER).toContain("Getting the latest...");
    expect(BANNER).toContain("Load the latest");
    expect(BANNER).toContain("router.refresh()");
    // Only once per saved copy by itself, so a page that can't load never loops.
    expect(BANNER).toContain('sessionStorage.getItem("rr-saved-tried") === key');
    // Offline still says it, with the time when it's known.
    expect(BANNER).toContain("You&apos;re seeing what this phone saved{saved ? saved.when : \" last\"}.");
    expect(BANNER).not.toMatch(/—/);
  });

  it("reads the mark once, as the page loads, so a rebuilt <head> can't make the saved copy pass for live", () => {
    expect(BANNER).toContain("if (firstMark === undefined) {");
    expect(BANNER).toContain('if (typeof document !== "undefined") markSnapshot();');
  });
});

function truck(id: string, name: string): LoadOutTruckRow {
  return {
    t: { id, name, type: "truck", yardName: "Odessa" } as unknown as LoadOutTruckRow["t"],
    pieces: 6, status: "blocked", why: null, whyTone: null, loadoutLine: null, doneToday: false, loadoutId: null,
    overridden: false, outSince: null, outTooLong: false, stillOut: null,
  };
}

describe("Load out board: a late plan that was scanned and blocked isn't 'not scanned out'", () => {
  const STILL = "Was planned to leave 5:00 AM. Still NOT READY.";
  const NOBODY = "Was planned to leave 5:00 AM. Nobody has scanned it out.";
  const OLD = "Was planned to leave Sat 5:00 AM, more than a day ago. That plan doesn't lock a load-out any more. Set a new time or clear it.";
  const plan = (late: string) => ({ text: "Job", by: null, note: null, late });
  const board = (plans: Record<string, ReturnType<typeof plan>>) => renderToStaticMarkup(createElement(LoadOutView, {
    trucks: [truck("ct01", "CT-01"), truck("ct02", "CT-02"), truck("ct03", "CT-03")],
    counts: { ready: 0, blocked: 3, out: 0, outTooLong: 0 }, summary: "", manager: true, plans,
  }));
  const alertBox = (html: string) => html.match(/<div role="alert"[\s\S]*?<\/div><\/div><\/div>/)?.[0] ?? "";

  it("one of each: its own heading for each", () => {
    const box = alertBox(board({ ct01: plan(STILL), ct02: plan(NOBODY) }));
    expect(box).toContain("A planned truck is still blocked");
    expect(box).toContain("A truck hasn&#x27;t been scanned out");
    expect(box.indexOf("still blocked")).toBeLessThan(box.indexOf("CT-01:"));
    expect(box.indexOf("CT-01:")).toBeLessThan(box.indexOf("been scanned out"));
    expect(box.indexOf("been scanned out")).toBeLessThan(box.indexOf("CT-02:"));
  });

  it("two scanned and blocked: they don't count as not scanned out", () => {
    const html = board({ ct01: plan(STILL), ct02: plan(STILL) });
    expect(html).toContain("Planned to leave, still blocked");
    expect(html).not.toContain("been scanned out");
  });

  it("not scanned and an old plan stay under 'haven't been scanned out'", () => {
    const html = board({ ct02: plan(NOBODY), ct03: plan(OLD) });
    expect(html).toContain("2 trucks haven&#x27;t been scanned out");
    expect(html).not.toContain("still blocked");
  });

  it("nothing late: no box", () => {
    expect(board({})).not.toContain('role="alert"');
  });
});
