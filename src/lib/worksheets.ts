import { EXERCISES } from "./exercises";

export const MAX_FIELD = 5000;

/**
 * Check a worksheet payload against the worksheet it claims to belong to. Only the
 * worksheet's current field ids are kept and text is capped; anything else (answers to
 * fields that no longer exist, other keys) is counted in `skipped` and dropped from the
 * account copy. The browser copy is never touched by this.
 */
export function cleanWorksheet(code: unknown, v: unknown, d: unknown):
  | { ok: true; code: string; values: Record<string, string>; days: boolean[]; skipped: number }
  | { ok: false } {
  if (typeof code !== "string" || !Object.prototype.hasOwnProperty.call(EXERCISES, code)) return { ok: false };
  const ex = EXERCISES[code];
  const ids = new Set(ex.groups.flatMap((g) => g.fields.map((f) => f.id)));
  const values: Record<string, string> = {};
  let skipped = 0;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val !== "string" || !ids.has(k)) {
        skipped++;
        continue;
      }
      if (val.trim()) values[k] = val.slice(0, MAX_FIELD);
    }
  }
  const n = ex.days ?? 0;
  const days = Array.from({ length: n }, (_, i) => Array.isArray(d) && d[i] === true);
  return { ok: true, code, values, days, skipped };
}
