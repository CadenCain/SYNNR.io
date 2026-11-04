import { describe, it, expect } from "vitest";
import { photoPathOk, photoTakenMs } from "../loadout-photo";

const co = "11111111-1111-1111-1111-111111111111";
const truck = "22222222-2222-2222-2222-222222222222";
const started = 1_762_200_000_000;
const now = started + 20 * 60e3;
const path = (s: number, t: number, c = co, u = truck) => `${c}/loadout/${u}/${s}-${t}.jpg`;

describe("photo of the loaded truck", () => {
  it("counts this load-out's photo", () => {
    expect(photoPathOk(path(started, started + 15 * 60e3), co, truck, started, now)).toBe(true);
  });
  it("doesn't count another company's, another truck's, or another load-out's photo", () => {
    expect(photoPathOk(path(started, started + 60e3, "33333333-3333-3333-3333-333333333333"), co, truck, started, now)).toBe(false);
    expect(photoPathOk(path(started, started + 60e3, co, "44444444-4444-4444-4444-444444444444"), co, truck, started, now)).toBe(false);
    expect(photoPathOk(path(started - 86_400_000, started - 86_400_000 + 60e3), co, truck, started, now)).toBe(false);
  });
  it("doesn't count a photo taken before the load-out started or after it saved", () => {
    expect(photoPathOk(path(started, started - 10 * 60e3), co, truck, started, now)).toBe(false);
    expect(photoPathOk(path(started, now + 10 * 60e3), co, truck, started, now)).toBe(false);
  });
  it("doesn't count anything that isn't a path the phone makes", () => {
    for (const bad of [undefined, null, 42, "", `${co}/loadout/${truck}/../cert/x.jpg`, `${co}/cert/${truck}/${started}-${started}.jpg`, `${path(started, started)}.png`, `${co}/loadout/${truck}/${started}-${started}.jpg?x`]) {
      expect(photoPathOk(bad, co, truck, started, now)).toBe(false);
    }
  });
  it("reads when it was taken", () => {
    expect(photoTakenMs(path(started, started + 5000))).toBe(started + 5000);
    expect(photoTakenMs("x/y.jpg")).toBe(null);
  });
});
