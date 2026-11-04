/**
 * The photo of the loaded truck. The phone puts it in the company's folder
 * for that truck, named for the load-out it belongs to and when it was taken:
 * `<company>/loadout/<truck>/<started ms>-<taken ms>.jpg`. A path that isn't
 * this load-out's, or a photo taken outside it, doesn't count.
 */
export function photoPathOk(path: unknown, companyId: string, unitId: string, startedMs: number, nowMs: number): path is string {
  if (typeof path !== "string" || path.length > 200) return false;
  const folder = `${companyId}/loadout/${unitId}/`;
  if (!path.startsWith(folder)) return false;
  const m = /^(\d{10,14})-(\d{10,14})\.jpg$/.exec(path.slice(folder.length));
  if (!m || Number(m[1]) !== startedMs) return false;
  const taken = Number(m[2]);
  return taken >= startedMs - 60e3 && taken <= nowMs + 60e3;
}

/** When the photo was taken, from its name. */
export function photoTakenMs(path: string): number | null {
  const n = Number(/-(\d{10,14})\.jpg$/.exec(path)?.[1]);
  return n || null;
}
