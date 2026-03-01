import type { CutoffCategory } from "@/lib/types";

const CALENDAR_DAYS: Record<Exclude<CutoffCategory, "other">, number> = {
  concrete: 2,
  pump: 5,
  timber_nonstandard: 5,
  pavers: 10,
};

/**
 * Default cut-off: calendar days before needed_date.
 * concrete: -2, pump: -5, timber_nonstandard: -5, pavers: -10 (min), other: no default.
 * Returns end of that calendar day in local time (e.g. 23:59:59) as ISO string for consistency.
 */
export function getDefaultCutoff(
  neededDate: Date,
  category: CutoffCategory
): Date | null {
  if (category === "other") return null;
  const days = CALENDAR_DAYS[category];
  const d = new Date(neededDate);
  d.setDate(d.getDate() - days);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function getDefaultCutoffISO(
  neededDateStr: string,
  category: CutoffCategory
): string | null {
  const needed = new Date(neededDateStr);
  if (Number.isNaN(needed.getTime())) return null;
  const result = getDefaultCutoff(needed, category);
  return result ? result.toISOString() : null;
}
