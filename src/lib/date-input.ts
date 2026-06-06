// Shared helpers for <input type="date"> and <input type="datetime-local">.
//
// Background: HTML date inputs require exactly YYYY-MM-DD (4-digit year).
// Postgres may return 6-digit years for far-future dates (e.g. "222222-02-22").
// Passing such a value to a date input causes React hydration mismatches that
// can kill the Turbopack worker in dev mode. These helpers normalize values on
// the way in, and validate + clamp them on the way out.

export const MIN_DATE     = "2024-01-01";
export const MAX_DATE     = "2100-12-31";
export const MIN_DATETIME = "2024-01-01T00:00";
export const MAX_DATETIME = "2100-12-31T23:59";

/**
 * Convert a Postgres/ISO timestamp to a safe YYYY-MM-DD string for
 * <input type="date" value={...}>.
 * Returns "" for null/undefined/non-4-digit-year values.
 */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/**
 * Convert a Postgres/ISO timestamp to a safe YYYY-MM-DDTHH:mm string for
 * <input type="datetime-local" value={...}>.
 * Returns "" for null/undefined/non-4-digit-year values.
 */
export function toDateTimeLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : "";
}

/**
 * Validate a date input value before saving to DB.
 * - Blank value: returns null (when optional=true, default) or throws (when optional=false).
 * - Valid YYYY-MM-DD in [MIN_DATE, MAX_DATE]: returns the value.
 * - Anything else: throws a user-facing Error.
 */
export function validateDateInput(value: string, optional = true): string | null {
  const v = value.trim();
  if (!v) {
    if (optional) return null;
    throw new Error("Date is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new Error("Please enter a valid date between 2024 and 2100.");
  const d = new Date(v);
  if (isNaN(d.getTime()))
    throw new Error("Please enter a valid date between 2024 and 2100.");
  if (v < MIN_DATE || v > MAX_DATE)
    throw new Error("Please enter a date between 2024 and 2100.");
  return v;
}

/**
 * Validate a datetime-local input value before saving to DB.
 * - Blank value: returns null (when optional=true, default) or throws (when optional=false).
 * - Valid YYYY-MM-DDTHH:mm in [MIN_DATETIME, MAX_DATETIME]: returns the value.
 * - Anything else: throws a user-facing Error.
 */
export function validateDateTimeLocalInput(value: string, optional = true): string | null {
  const v = value.trim();
  if (!v) {
    if (optional) return null;
    throw new Error("Date and time is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v))
    throw new Error("Please enter a valid date and time between 2024 and 2100.");
  const d = new Date(v);
  if (isNaN(d.getTime()))
    throw new Error("Please enter a valid date and time between 2024 and 2100.");
  const dateOnly = v.slice(0, 10);
  if (dateOnly < MIN_DATE || dateOnly > MAX_DATE)
    throw new Error("Please enter a date and time between 2024 and 2100.");
  return v;
}
