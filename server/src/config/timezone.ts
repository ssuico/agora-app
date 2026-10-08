export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/New_York';

/**
 * Compute the offset (in minutes) between UTC and the given IANA timezone
 * at a specific instant. Equivalent to Date.getTimezoneOffset() for that zone.
 * Positive means UTC is ahead of local (e.g. 300 for EST / UTC-5).
 */
function getTzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => {
    const v = parts.find((p) => p.type === type)?.value;
    return parseInt(v ?? '0', 10);
  };

  let hour = get('hour');
  if (hour === 24) hour = 0;

  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (date.getTime() - localAsUtc) / (60 * 1000);
}

/**
 * Return the UTC instant range [dayStart, dayEnd] that corresponds to the
 * full calendar day of `dateUtcMidnight` in APP_TIMEZONE.
 *
 * @param dateUtcMidnight A Date set to UTC midnight (from toDateOnly).
 */
export function localDayRange(dateUtcMidnight: Date) {
  const offsetMs = getTzOffsetMinutes(dateUtcMidnight, APP_TIMEZONE) * 60 * 1000;
  const dayStart = new Date(dateUtcMidnight.getTime() + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { dayStart, dayEnd };
}

/**
 * Convert a UTC timestamp to its local calendar-date string (YYYY-MM-DD)
 * in APP_TIMEZONE.
 */
export function toLocalDateStr(date: Date): string {
  const offsetMinutes = getTzOffsetMinutes(date, APP_TIMEZONE);
  const local = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

/**
 * Return the UTC instant range [dayStart, dayEnd] for the full calendar day
 * given by `dateStr` (YYYY-MM-DD) in APP_TIMEZONE. Use this when the date
 * string is intended as a local calendar date (e.g. from a date picker).
 */
export function localDayRangeFromDateString(dateStr: string): { dayStart: Date; dayEnd: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const offsetMs = getTzOffsetMinutes(new Date(noonUtc), APP_TIMEZONE) * 60 * 1000;
  const dayStart = new Date(noonUtc - 12 * 60 * 60 * 1000 + offsetMs);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { dayStart, dayEnd };
}

/**
 * Interpret `YYYY-MM-DDTHH:mm` as a wall-clock time in APP_TIMEZONE (Eastern)
 * and return the UTC instant.
 */
export function localDateTimeFromString(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new Error('Invalid date and time');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new Error('Invalid date and time');
  }
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const offsetMs = getTzOffsetMinutes(new Date(wallAsUtc), APP_TIMEZONE) * 60 * 1000;
  const instant = new Date(wallAsUtc + offsetMs);
  const corrected = getTzOffsetMinutes(instant, APP_TIMEZONE) * 60 * 1000;
  return corrected === offsetMs ? instant : new Date(wallAsUtc + corrected);
}
