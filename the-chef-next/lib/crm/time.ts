/**
 * CRM times are shown and entered in the business time zone (Eastern), the
 * same zone the database uses for scheduling (`America/New_York` in the
 * migrations). Server components run in UTC, so never format a CRM timestamp
 * with a bare `toLocaleString()`: use these helpers.
 */
export const CRM_TIME_ZONE = "America/New_York";

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "11/10/2026, 2:15:51 PM ET", or "" for an empty or invalid value. */
export function formatEtDateTime(value: DateInput): string {
  const date = toDate(value);
  return date
    ? `${date.toLocaleString("en-US", { timeZone: CRM_TIME_ZONE })} ET`
    : "";
}

/** "11/24/2026" (calendar date in Eastern time), or "" for an empty or invalid value. */
export function formatEtDate(value: DateInput): string {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-US", { timeZone: CRM_TIME_ZONE })
    : "";
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` from UTC at the instant `utcMs`, in milliseconds. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(new Date(utcMs), timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Value for an `<input type="datetime-local">`: the Eastern wall time of a
 * stored timestamp, "YYYY-MM-DDTHH:mm", or "" when empty.
 */
export function toEtInputValue(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";
  const p = zonedParts(date, CRM_TIME_ZONE);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Converts a `datetime-local` value typed in Eastern time
 * ("YYYY-MM-DDTHH:mm" or with seconds) into a UTC ISO timestamp, handling
 * daylight-saving changes. Throws on a malformed value.
 */
export function etInputToIso(local: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(local);
  if (!match) throw new RangeError("Expected YYYY-MM-DDTHH:mm");
  const [, y, mo, d, h, mi, s] = match;
  const wallAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  // Two passes settle the offset on either side of a daylight-saving change.
  let utc = wallAsUtc - zoneOffsetMs(wallAsUtc, CRM_TIME_ZONE);
  utc = wallAsUtc - zoneOffsetMs(utc, CRM_TIME_ZONE);
  return new Date(utc).toISOString();
}
