/**
 * Calendar helpers. Dates are integer day numbers (days since 1970-01-01, UTC);
 * times are minutes after midnight. Nothing here depends on the local time zone.
 */

const MS_DAY = 86_400_000;
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function dayOf(iso: string): number {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}

export function ymd(day: number): { y: number; m: number; d: number } {
  const dt = new Date(day * MS_DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** ISO 8601 date, e.g. 2023-03-07. */
export function iso(day: number): string {
  const { y, m, d } = ymd(day);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** ISO 8601 datetime to the minute, e.g. 2023-03-07T08:15. */
export function isoDT(day: number, minutes: number): string {
  return `${iso(day)}T${hhmm(minutes)}`;
}

export function hhmm(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/** EDC-style date text, e.g. "07 MAR 2023". */
export function edc(day: number): string {
  const { y, m, d } = ymd(day);
  return `${pad2(d)} ${MONTHS[m - 1]} ${y}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day of week, 0 = Sunday … 6 = Saturday. */
export function weekday(day: number): number {
  return new Date(day * MS_DAY).getUTCDay();
}

/** Move a Saturday/Sunday to the nearest weekday (Sat → Fri, Sun → Mon). */
export function toWeekday(day: number): number {
  const w = weekday(day);
  if (w === 6) return day - 1;
  if (w === 0) return day + 1;
  return day;
}

/** A possibly-partial date as collected (day and/or month unknown). */
export interface PartialDate {
  y: number;
  m?: number;
  d?: number;
}

export function partialOf(day: number, keep: 'full' | 'month' | 'year'): PartialDate {
  const { y, m, d } = ymd(day);
  if (keep === 'full') return { y, m, d };
  if (keep === 'month') return { y, m };
  return { y };
}

/** ISO 8601 (possibly reduced precision): 2019-03-15, 2019-03, 2019. */
export function isoPartial(p: PartialDate): string {
  if (p.m === undefined) return String(p.y);
  if (p.d === undefined) return `${p.y}-${pad2(p.m)}`;
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/** EDC partial date text: "15 MAR 2019", "UN MAR 2019", "UN UNK 2019". */
export function edcPartial(p: PartialDate): string {
  const dd = p.d === undefined ? 'UN' : pad2(p.d);
  const mm = p.m === undefined ? 'UNK' : MONTHS[p.m - 1];
  return `${dd} ${mm} ${p.y}`;
}

export function isComplete(p: PartialDate): boolean {
  return p.m !== undefined && p.d !== undefined;
}

export function dayOfPartial(p: PartialDate): number | null {
  if (p.m === undefined || p.d === undefined) return null;
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS_DAY);
}

/** SDTM study day: date − reference + 1 on/after the reference date, date − reference before it (no day 0). */
export function studyDay(day: number, ref: number): number {
  return day >= ref ? day - ref + 1 : day - ref;
}

/** Days → months (1 month = 30.4375 days), used only for reporting. */
export const DAYS_PER_MONTH = 30.4375;
