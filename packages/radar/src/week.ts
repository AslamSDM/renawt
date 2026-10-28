/** ISO-8601 week keys, e.g. "2026-W44". Computed in UTC. */

export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weekKey(date: Date = new Date()): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseWeekKey(key: string): { year: number; week: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Invalid week key: ${key}`);
  return { year: Number(m[1]), week: Number(m[2]) };
}

/** Monday 00:00 UTC of the given ISO week. */
export function weekStart(key: string): Date {
  const { year, week } = parseWeekKey(key);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (jan4Day - 1) * 86400000);
  return new Date(mondayW1.getTime() + (week - 1) * 7 * 86400000);
}

export function previousWeekKey(keyOrDate: string | Date = new Date()): string {
  const start = typeof keyOrDate === "string" ? weekStart(keyOrDate) : weekStart(weekKey(keyOrDate));
  return weekKey(new Date(start.getTime() - 7 * 86400000));
}
