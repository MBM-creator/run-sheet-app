import { DateTime } from "luxon";
import { DEFAULT_TZ } from "@/lib/timezone";

/**
 * Format an ISO timestamp for display in the given timezone.
 * Use for cutoff_datetime and other stored UTC times so display is consistent (Australia/Melbourne).
 */
export function formatDateTimeLocal(
  iso: string,
  tz: string = DEFAULT_TZ
): string {
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(tz);
  if (!dt.isValid) return iso;
  return dt.toLocaleString(DateTime.DATETIME_SHORT);
}
