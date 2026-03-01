import { DateTime } from "luxon";

/**
 * Returns UTC ISO string for 12:00 (noon) local time on the given date in the given timezone.
 * @param dateStr YYYY-MM-DD
 * @param tz IANA timezone (e.g. "Australia/Melbourne")
 */
export function toUtcIsoAtLocalNoon(dateStr: string, tz: string): string {
  const dt = DateTime.fromISO(dateStr, { zone: tz })
    .set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  if (!dt.isValid) throw new Error(`Invalid date or zone: ${dateStr}, ${tz}`);
  return dt.toUTC().toISO()!;
}
