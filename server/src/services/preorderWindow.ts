import { localDateTimeFromString, localDayRangeFromDateString } from '../config/timezone.js';

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;
const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DDTHH:mm` is Eastern wall time. An ISO instant (the manager's local clock) is used as-is. */
export function parsePreOrderClosesAt(
  value: unknown
): { ok: true; date: Date | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') return { ok: true, date: null };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { ok: false, message: 'Order deadline is invalid' }
      : { ok: true, date: value };
  }
  if (typeof value !== 'string') return { ok: false, message: 'Order deadline is invalid' };
  const trimmed = value.trim();
  if (WALL_CLOCK.test(trimmed)) {
    try {
      return { ok: true, date: localDateTimeFromString(trimmed) };
    } catch {
      return { ok: false, message: 'Order deadline is invalid' };
    }
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { ok: false, message: 'Order deadline is invalid' };
  return { ok: true, date };
}

/** `YYYY-MM-DD` is an Eastern calendar day. An ISO instant is the manager's local expected availability time. */
export function parseExpectedDate(value: unknown): { ok: true; date: Date | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') return { ok: true, date: null };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { ok: false, message: 'Expected availability date is invalid' }
      : { ok: true, date: value };
  }
  if (typeof value !== 'string') return { ok: false, message: 'Expected availability date is invalid' };
  const trimmed = value.trim();
  if (CALENDAR_DAY.test(trimmed)) {
    try {
      return { ok: true, date: localDayRangeFromDateString(trimmed).dayStart };
    } catch {
      return { ok: false, message: 'Expected availability date is invalid' };
    }
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { ok: false, message: 'Expected availability date is invalid' };
  return { ok: true, date };
}

export function cutoffError(
  closesAt: Date | null,
  expected: Date | null,
  options: { required: boolean; requireFuture: boolean }
): string | null {
  if (!closesAt) {
    return options.required ? 'Set the date and time when pre-orders close' : null;
  }
  if (options.requireFuture && closesAt.getTime() <= Date.now()) {
    return 'The order deadline must be in the future';
  }
  if (expected && closesAt.getTime() >= expected.getTime()) {
    return 'Orders must close before the expected availability time';
  }
  return null;
}
