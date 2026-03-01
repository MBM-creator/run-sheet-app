/**
 * Default timezone for cutoff "noon" and display (v1: single region).
 * Optionally override via env MBM_DEFAULT_TZ.
 */
export const DEFAULT_TZ =
  (typeof process !== "undefined" && process.env?.MBM_DEFAULT_TZ) ||
  "Australia/Melbourne";
