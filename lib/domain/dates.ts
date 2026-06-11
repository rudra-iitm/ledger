export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function yearOf(isoDate: string): string {
  return isoDate.slice(0, 4);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function compareMonths(a: string, b: string): number {
  return a.localeCompare(b);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function clampedDateInMonth(month: string, dayOfMonth: number): string {
  const day = Math.min(dayOfMonth, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseISODate(isoDate);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonthsClamped(isoDate: string, months: number, dayOfMonth: number): string {
  const date = parseISODate(isoDate);
  const targetMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  let month = targetMonth;
  for (let i = 0; i < months; i += 1) month = nextMonth(month);
  return clampedDateInMonth(month, dayOfMonth);
}

export function addYears(isoDate: string, years: number): string {
  const date = parseISODate(isoDate);
  date.setFullYear(date.getFullYear() + years);
  return toISODate(date);
}

export function weekdayOf(isoDate: string): number {
  return parseISODate(isoDate).getDay();
}

export function startOfWeek(isoDate: string, weekStartsOn = 1): string {
  const date = parseISODate(isoDate);
  const day = date.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toISODate(date);
}

export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: y === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDisplayMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
