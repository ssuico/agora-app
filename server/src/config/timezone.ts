export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Manila';

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
