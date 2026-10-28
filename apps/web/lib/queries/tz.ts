/** Wall-clock date+time in an IANA zone → UTC Date. Intl only; two passes handle DST edges. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let guess = target;
  for (let i = 0; i < 2; i++) guess = target - offsetMs(guess, timeZone);
  return new Date(guess);
}

function offsetMs(utc: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(utc / 1000) * 1000;
}

/** Current wall clock in a zone as {date:"YYYY-MM-DD", time:"HH:MM"}, rounded up to the next 15 minutes + lead. */
export function zonedNow(timeZone: string, leadMinutes = 30): { date: string; time: string } {
  const t = new Date(Math.ceil((Date.now() + leadMinutes * 60_000) / 900_000) * 900_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(t);
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
}

/** Calendar parts of an instant in a zone. weekday: 1 = Monday … 7 = Sunday. */
export function zonedParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(d);
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[g("weekday")] ?? 1;
  return { year: Number(g("year")), month: Number(g("month")), day: Number(g("day")), hour: Number(g("hour")) % 24, minute: Number(g("minute")), weekday: wd };
}

/** Monday 00:00 of the week (offset in weeks from now) in `timeZone`, as a UTC Date, plus the 7 day dates (YYYY-MM-DD). */
export function zonedWeek(timeZone: string, offsetWeeks = 0) {
  const p = zonedParts(new Date(), timeZone);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day - (p.weekday - 1) + offsetWeeks * 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const start = zonedToUtc(days[0], "00:00", timeZone);
  const endDay = new Date(base);
  endDay.setUTCDate(base.getUTCDate() + 7);
  const end = zonedToUtc(endDay.toISOString().slice(0, 10), "00:00", timeZone);
  return { start, end, days };
}

/**
 * Next default posting slot: today at `hour`:00 in the zone if that is still at least
 * `leadMinutes` away, otherwise tomorrow. Matches the series default (18:00).
 */
export function nextSlot(timeZone: string, hour = 18, leadMinutes = 30): { date: string; time: string } {
  const now = zonedNow(timeZone, leadMinutes);
  const time = `${String(hour).padStart(2, "0")}:00`;
  if (now.time <= time) return { date: now.date, time };
  const [y, m, d] = now.date.split("-").map(Number);
  return { date: new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10), time };
}
