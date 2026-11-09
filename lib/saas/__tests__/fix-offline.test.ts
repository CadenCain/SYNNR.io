import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LoadOutView from "@/app/app/_components/loadout-view";
import { readNeverSent } from "@/app/app/_components/never-sent-drafts";
import type { LoadOutTruckRow } from "@/lib/saas/loadout-board";

/**
 * Offline and weak signal (public/sw.js, the Load out board, the no-signal
 * banner): one bar no longer means a blank screen, the no-signal page tells
 * the truth, an out truck's load-out opens from the saved board, and a
 * load-out that never sent says so instead of vanishing.
 */

const ORIGIN = "https://www.synnr.io";
const SW = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");

type Res = { ok: boolean; redirected: boolean; type: string; url: string; status: number; clone(): Res; text(): Promise<string> };
const res = (body: string, over: Partial<Res> = {}): Res => {
  const r: Res = { ok: true, redirected: false, type: "basic", url: `${ORIGIN}/app`, status: 200, clone: () => res(body, over), text: async () => body, ...over };
  return r;
};

/** Load sw.js into a fake service worker scope. */
function boot(fetchImpl: (req: unknown) => Promise<Res>) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const store = new Map<string, Map<string, Res>>();
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name)!;
      return {
        match: async (k: string) => c.get(typeof k === "string" ? k : String(k)),
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
  const ctx = vm.createContext({ self, caches, fetch: fetchImpl, URL, Response, setTimeout, clearTimeout, Promise, console });
  vm.runInContext(SW, ctx);

  function go(pathname: string, method = "GET", mode = "navigate") {
    let responded: Promise<Res> | null = null;
    const waits: Promise<unknown>[] = [];
    handlers.fetch({
      request: { method, url: `${ORIGIN}${pathname}`, mode },
      respondWith: (p: Promise<Res>) => { responded = p; },
      waitUntil: (p: Promise<unknown>) => { waits.push(p); },
    });
    return { responded: responded as Promise<Res> | null, waits };
  }
  const saved = (k: string) => store.get("rr-pages-v1")?.get(`${ORIGIN}${k}`);
  const save = async (k: string, r: Res) => (await caches.open("rr-pages-v1")).put(`${ORIGIN}${k}`, r);
  return { go, saved, save, store };
}

/** A network answer that comes when the test says so. */
function deferred() {
  let resolve!: (r: Res) => void, reject!: (e: unknown) => void;
  const p = new Promise<Res>((a, b) => { resolve = a; reject = b; });
  return { p, resolve, reject };
}

describe("sw.js: one bar of signal", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("shows the saved copy after 5 seconds, and the late network answer still saves", async () => {
    const net = deferred();
    const sw = boot(() => net.p);
    await sw.save("/app", res("saved board"));
    const { responded, waits } = sw.go("/app");
    let got: Res | null = null;
    void responded!.then((r) => { got = r; });

    await vi.advanceTimersByTimeAsync(4900);
    expect(got).toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(await got!.text()).toBe("saved board");

    net.resolve(res("fresh board"));
    await Promise.all(waits);
    expect(await sw.saved("/app")!.text()).toBe("fresh board");
  });

  it("a quick network answer wins and replaces the saved copy", async () => {
    const sw = boot(async () => res("fresh scan page", { url: `${ORIGIN}/app/units/u1/scan` }));
    await sw.save("/app/units/u1/scan", res("old scan page"));
    const { responded, waits } = sw.go("/app/units/u1/scan");
    expect(await (await responded!).text()).toBe("fresh scan page");
    await Promise.all(waits);
    expect(await sw.saved("/app/units/u1/scan")!.text()).toBe("fresh scan page");
  });

  it("nothing saved for the page: keeps waiting on the network past 5 seconds", async () => {
    const net = deferred();
    const sw = boot(() => net.p);
    const { responded } = sw.go("/app/units/u1");
    let got: Res | null = null;
    void responded!.then((r) => { got = r; });
    await vi.advanceTimersByTimeAsync(30000);
    expect(got).toBeNull();
    net.resolve(res("truck page"));
    await vi.advanceTimersByTimeAsync(0);
    expect(await got!.text()).toBe("truck page");
    // The truck page is never saved for offline.
    expect(sw.saved("/app/units/u1")).toBeUndefined();
  });

  it("no signal at all: the saved copy right away", async () => {
    const sw = boot(async () => { throw new TypeError("Failed to fetch"); });
    await sw.save("/app/return", res("saved check-in"));
    const { responded } = sw.go("/app/return");
    expect(await (await responded!).text()).toBe("saved check-in");
  });

  it("the no-signal page says what does work and links to Load out, no loop", async () => {
    const sw = boot(async () => { throw new TypeError("Failed to fetch"); });
    const { responded } = sw.go("/app/units/u1");
    const r = (await responded!) as unknown as Response;
    expect(r.status).toBe(503);
    const html = await r.text();
    expect(html).toContain("isn't saved on this phone");
    expect(html).toContain("each truck's load-out and check-in");
    expect(html).toContain('href="/app"');
    expect(html).not.toContain("Open the Load out screen once");
    expect(html).not.toMatch(/—/);
  });

  it("signed out (a saved page now redirects) throws every saved page away, even after the saved copy showed", async () => {
    const net = deferred();
    const sw = boot(() => net.p);
    await sw.save("/app", res("saved board"));
    await sw.save("/app/units/u1/scan", res("saved scan"));
    const { responded, waits } = sw.go("/app");
    await vi.advanceTimersByTimeAsync(5000);
    expect(await (await responded!).text()).toBe("saved board");
    net.resolve(res("", { ok: false, status: 0, type: "opaqueredirect" }));
    await Promise.all(waits);
    expect(sw.store.has("rr-pages-v1")).toBe(false);
  });

  it("a followed redirect to sign in also clears, and a redirect never gets saved", async () => {
    const sw = boot(async () => res("login", { redirected: true, url: `${ORIGIN}/login` }));
    await sw.save("/app", res("saved board"));
    const { waits } = sw.go("/app");
    await Promise.all(waits);
    expect(sw.store.has("rr-pages-v1")).toBe(false);
  });

  it("server actions (POST) and screens outside /app are never answered by the worker", () => {
    const sw = boot(async () => res("x"));
    expect(sw.go("/app/units/u1/scan", "POST").responded).toBeNull();
    expect(sw.go("/pricing").responded).toBeNull();
    // Next's in-app (RSC) fetches aren't navigations: never served from the saved copy.
    expect(sw.go("/app", "GET", "cors").responded).toBeNull();
  });
});

function truck(id: string, name: string, status: LoadOutTruckRow["status"]): LoadOutTruckRow {
  return {
    t: { id, name, type: "truck", yardName: "Odessa" } as unknown as LoadOutTruckRow["t"],
    pieces: 6, status, why: null, whyTone: null, loadoutLine: null, doneToday: false, loadoutId: null,
    overridden: false, outSince: status === "out" ? "2026-11-09T03:00:00Z" : null, outTooLong: false, stillOut: null,
  };
}

describe("Load out board: a truck out on a job", () => {
  const html = (hand: boolean) => renderToStaticMarkup(createElement(LoadOutView, {
    trucks: [truck("n201", "N2-01", "out"), truck("ct02", "CT-02", "ready")],
    counts: { ready: 1, blocked: 0, out: 1, outTooLong: 0 }, summary: "", hand, myTruckId: hand ? "n201" : null,
  }));

  it("offers Check in and a new load-out (the scan page is saved for no signal)", () => {
    for (const h of [false, true]) {
      const page = html(h);
      expect(page).toContain('href="/app/units/n201/return"');
      expect(page).toContain('href="/app/units/n201/scan"');
      expect(page).toContain("Start a new load-out");
    }
  });

  it("a truck in the yard keeps its one Start load-out button, no extra link", () => {
    const page = html(false);
    expect(page.match(/href="\/app\/units\/ct02\/scan"/g)?.length).toBe(1);
    expect(page.match(/Start a new load-out/g)?.length).toBe(1);
  });
});

/** A fake phone storage. */
function storage(entries: Record<string, unknown>) {
  const keys = Object.keys(entries);
  return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => (k in entries ? JSON.stringify(entries[k]) : null) };
}

describe("never-sent drafts: too old to send says so instead of vanishing", () => {
  const H = 3600e3;
  const now = Date.parse("2026-11-10T03:00:00Z");
  const trucks = [{ id: "n201", name: "N2-01" }, { id: "ct02", name: "CT-02" }];
  const scans = { a1: { how: "hand", at: 1 }, a2: { how: "nfc", at: 2 } };

  it("an 18.3 hour old load-out shows once, with who to tell", () => {
    const list = readNeverSent(storage({ "rr-loadout-n201": { scans, savedAt: now - 18.3 * H } }), trucks, now);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "rr-loadout-n201", truckId: "n201", label: "A load-out of N2-01", count: 2 });
    expect(list[0].tell).toBe("Tell a manager what went on N2-01.");
  });

  it("still fresh (the board's Not sent yet list has it), over 3 days, empty, or a photo: not shown", () => {
    const list = readNeverSent(storage({
      "rr-loadout-n201": { scans, savedAt: now - 10 * H },
      "rr-loadout-ct02": { scans, savedAt: now - 80 * H },
      "rr-return-ct02": { scans: {}, savedAt: now - 20 * H },
      "rr-loadout-photo-n201": { startedAt: "x", at: 1, data: "data:" },
      "rr-company": "c1",
    }), trucks, now);
    expect(list).toEqual([]);
  });

  it("check-ins too: a truck's, and a yard's loose iron", () => {
    const list = readNeverSent(storage({
      "rr-return-ct02": { scans, savedAt: now - 30 * H },
      "rr-return-yard-9": { scans: { a1: {} }, savedAt: now - 20 * H },
    }), trucks, now);
    expect(list.map((x) => x.label)).toEqual(["A check-in of CT-02", "A check-in"]);
    expect(list[0].tell).toBe("Tell a manager what came back off CT-02.");
    expect(list[1].tell).toBe("Tell a manager what came back.");
  });

  it("a load-out of a truck not on this board, or broken storage, is skipped", () => {
    const bad = { length: 2, key: (i: number) => ["rr-loadout-gone", "rr-loadout-n201"][i], getItem: (k: string) => (k === "rr-loadout-gone" ? JSON.stringify({ scans, savedAt: now - 20 * H }) : "{not json") };
    expect(readNeverSent(bad, trucks, now)).toEqual([]);
  });
});

describe("no-signal banner", () => {
  it("doesn't promise scans send by themselves", () => {
    const src = readFileSync(path.resolve(__dirname, "../../../app/app/_components/offline-support.tsx"), "utf8");
    expect(src).not.toContain("send when you&apos;re back in range.");
    expect(src).toContain("Open RollReady when you&apos;re back in range to send them.");
  });
});
