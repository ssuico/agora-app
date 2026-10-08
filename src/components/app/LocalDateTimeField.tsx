import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';

type Period = 'AM' | 'PM';

interface Parts {
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  period: Period;
}

const EMPTY: Parts = { month: '', day: '', year: '', hour: '', minute: '', period: 'AM' };

function from24(hour24: number): { hour: string; period: Period } {
  const period: Period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour: String(hour).padStart(2, '0'), period };
}

function to24(hour12: number, period: Period): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

function splitLocalDateTime(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return EMPTY;
  const clock = from24(Number(match[4]));
  return {
    month: match[2],
    day: match[3],
    year: match[1],
    hour: clock.hour,
    minute: match[5],
    period: clock.period,
  };
}

function composeLocalDateTime(parts: Parts): string {
  if (!parts.month || !parts.day || parts.year.length !== 4 || !parts.hour || !parts.minute) return '';
  const month = Number(parts.month);
  const day = Number(parts.day);
  const year = Number(parts.year);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59) return '';
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(to24(hour, parts.period))}:${pad(minute)}`;
}

function clamp(raw: string, min: number, max: number): string {
  if (!raw) return '';
  const n = Math.min(max, Math.max(min, Number(raw)));
  return String(n).padStart(2, '0');
}

export function LocalDateTimeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState<Parts>(() => splitLocalDateTime(value));
  const [prevValue, setPrevValue] = useState(value);
  const emitted = useRef(value);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== composeLocalDateTime(parts)) {
      const next = splitLocalDateTime(value);
      emitted.current = value;
      partsRef.current = next;
      setParts(next);
    }
  }

  const commit = (next: Parts) => {
    partsRef.current = next;
    setParts(next);
    const outgoing = composeLocalDateTime(next);
    if (outgoing !== emitted.current) {
      emitted.current = outgoing;
      onChange(outgoing);
    }
  };

  const setDigits = (
    key: 'month' | 'day' | 'year' | 'hour' | 'minute',
    raw: string,
    maxLength: number,
    nextFocus?: { current: HTMLInputElement | null }
  ) => {
    const digits = raw.replace(/\D/g, '').slice(0, maxLength);
    commit({ ...partsRef.current, [key]: digits });
    if (digits.length === maxLength) nextFocus?.current?.focus();
  };

  const bump = (key: 'month' | 'day' | 'year' | 'hour' | 'minute', delta: number) => {
    const limits = { month: [1, 12], day: [1, 31], year: [2000, 2100], hour: [1, 12], minute: [0, 59] } as const;
    const [min, max] = limits[key];
    const current = partsRef.current[key] === '' ? (delta > 0 ? min - 1 : max + 1) : Number(partsRef.current[key]);
    let next = current + delta;
    if (next > max) next = min;
    if (next < min) next = max;
    const width = key === 'year' ? 4 : 2;
    commit({ ...partsRef.current, [key]: String(next).padStart(width, '0') });
  };

  const pad = (key: 'month' | 'day' | 'hour' | 'minute', min: number, max: number) => {
    const current = partsRef.current;
    const next = clamp(current[key], min, max);
    if (next !== current[key]) commit({ ...current, [key]: next });
  };

  const onKeyDown = (key: 'month' | 'day' | 'year' | 'hour' | 'minute') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      bump(key, 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      bump(key, -1);
    }
  };

  const filled = Boolean(parts.month && parts.day && parts.year.length === 4 && parts.hour && parts.minute);
  const invalid = filled && !composeLocalDateTime(parts);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Segment
          id={id}
          label="Month"
          placeholder="MM"
          value={parts.month}
          width="w-14"
          onChange={(raw) => setDigits('month', raw, 2, dayRef)}
          onBlur={() => pad('month', 1, 12)}
          onKeyDown={onKeyDown('month')}
        />
        <span className="mb-2 text-muted-foreground" aria-hidden="true">/</span>
        <Segment
          id={`${id}-day`}
          label="Day"
          placeholder="DD"
          value={parts.day}
          width="w-14"
          inputRef={dayRef}
          onChange={(raw) => setDigits('day', raw, 2, yearRef)}
          onBlur={() => pad('day', 1, 31)}
          onKeyDown={onKeyDown('day')}
        />
        <span className="mb-2 text-muted-foreground" aria-hidden="true">/</span>
        <Segment
          id={`${id}-year`}
          label="Year"
          placeholder="YYYY"
          value={parts.year}
          width="w-20"
          inputRef={yearRef}
          onChange={(raw) => setDigits('year', raw, 4, hourRef)}
          onKeyDown={onKeyDown('year')}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Segment
          id={`${id}-hour`}
          label="Hour"
          placeholder="HH"
          value={parts.hour}
          width="w-14"
          inputRef={hourRef}
          onChange={(raw) => setDigits('hour', raw, 2, minuteRef)}
          onBlur={() => pad('hour', 1, 12)}
          onKeyDown={onKeyDown('hour')}
        />
        <span className="mb-2 text-muted-foreground" aria-hidden="true">:</span>
        <Segment
          id={`${id}-minute`}
          label="Minute"
          placeholder="MM"
          value={parts.minute}
          width="w-14"
          inputRef={minuteRef}
          onChange={(raw) => setDigits('minute', raw, 2)}
          onBlur={() => pad('minute', 0, 59)}
          onKeyDown={onKeyDown('minute')}
        />
        <div className="flex gap-1" role="group" aria-label="AM or PM">
          <Button
            type="button"
            size="sm"
            variant={parts.period === 'AM' ? 'default' : 'outline'}
            className="h-9 px-3"
            aria-pressed={parts.period === 'AM'}
            onClick={() => commit({ ...parts, period: 'AM' })}
          >
            AM
          </Button>
          <Button
            type="button"
            size="sm"
            variant={parts.period === 'PM' ? 'default' : 'outline'}
            className="h-9 px-3"
            aria-pressed={parts.period === 'PM'}
            onClick={() => commit({ ...parts, period: 'PM' })}
          >
            PM
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Type each number. Up and down arrows change a box.</p>
      {invalid && (
        <p className="text-xs text-destructive">Enter a real date and a time from 1:00 to 12:59.</p>
      )}
    </div>
  );
}

function Segment({
  id,
  label,
  placeholder,
  value,
  width,
  inputRef,
  onChange,
  onBlur,
  onKeyDown,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  width: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`flex flex-col gap-1 ${width}`}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-label={label}
        className="px-1 text-center tabular-nums"
        onFocus={(event) => event.target.select()}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
