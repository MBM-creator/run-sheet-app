const MIN_EXPIRES_DAYS = 1;
const MAX_EXPIRES_DAYS = 365;
const DEFAULT_EXPIRES_DAYS = 90;

export { DEFAULT_EXPIRES_DAYS, MIN_EXPIRES_DAYS, MAX_EXPIRES_DAYS };

export type ExpiresValidation =
  | { ok: true; expiresInDays: number }
  | { ok: false; status: 400; error: string };

/**
 * Validate expires_in_days: integer only, min 1, max 365.
 * Default 90 when omitted. Returns 400-style error for invalid input.
 */
export function validateExpiresInDays(
  value: unknown
): ExpiresValidation {
  if (value === undefined || value === null) {
    return { ok: true, expiresInDays: DEFAULT_EXPIRES_DAYS };
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return {
      ok: false,
      status: 400,
      error: "expires_in_days must be a number",
    };
  }
  if (!Number.isInteger(value)) {
    return {
      ok: false,
      status: 400,
      error: "expires_in_days must be an integer",
    };
  }
  if (value < MIN_EXPIRES_DAYS) {
    return {
      ok: false,
      status: 400,
      error: `expires_in_days must be at least ${MIN_EXPIRES_DAYS}`,
    };
  }
  if (value > MAX_EXPIRES_DAYS) {
    return {
      ok: false,
      status: 400,
      error: `expires_in_days must be at most ${MAX_EXPIRES_DAYS}`,
    };
  }
  return { ok: true, expiresInDays: value };
}
