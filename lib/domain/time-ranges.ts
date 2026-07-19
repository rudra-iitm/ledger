import {
  addDays,
  currentMonth,
  monthOf,
  previousMonth,
  startOfWeek,
  todayISO,
} from "./dates";

export const TIME_PRESETS = [
  "today",
  "yesterday",
  "last7",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
  "thisFY",
  "lastFY",
  "all",
  "custom",
] as const;

export type TimePreset = (typeof TIME_PRESETS)[number];

export interface DateRange {
  start: string | null;
  end: string | null;
}

export const TIME_PRESET_LABELS: Record<TimePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  thisWeek: "This Week",
  lastWeek: "Last Week",
  thisMonth: "This Month",
  lastMonth: "Last Month",
  thisYear: "This Year",
  thisFY: "This FY (Apr–Mar)",
  lastFY: "Last FY",
  all: "All Time",
  custom: "Custom Range",
};

/** Indian financial year (April 1 – March 31) containing the given date. */
export function financialYearRange(
  isoDate: string,
  yearsBack = 0,
): { start: string; end: string; label: string } {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const fyStartYear = (month >= 4 ? year : year - 1) - yearsBack;
  return {
    start: `${fyStartYear}-04-01`,
    end: `${fyStartYear + 1}-03-31`,
    label: `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`,
  };
}

export function resolveRange(
  preset: TimePreset,
  custom: DateRange = { start: null, end: null },
  now: Date = new Date(),
): DateRange {
  const today = todayISO(now);
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y };
    }
    case "last7":
      return { start: addDays(today, -6), end: today };
    case "thisWeek":
      return { start: startOfWeek(today), end: today };
    case "lastWeek": {
      const lastWeekStart = addDays(startOfWeek(today), -7);
      return { start: lastWeekStart, end: addDays(lastWeekStart, 6) };
    }
    case "thisMonth":
      return { start: `${currentMonth(now)}-01`, end: today };
    case "lastMonth": {
      const prev = previousMonth(monthOf(today));
      return { start: `${prev}-01`, end: `${prev}-31` };
    }
    case "thisYear":
      return { start: `${today.slice(0, 4)}-01-01`, end: today };
    case "thisFY": {
      const fy = financialYearRange(today);
      return { start: fy.start, end: today };
    }
    case "lastFY": {
      const fy = financialYearRange(today, 1);
      return { start: fy.start, end: fy.end };
    }
    case "custom":
      return custom;
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function inRange(isoDate: string, range: DateRange): boolean {
  if (range.start && isoDate < range.start) return false;
  if (range.end && isoDate > range.end) return false;
  return true;
}

export function rangeLength(range: DateRange, now: Date = new Date()): number {
  const start = range.start ?? null;
  const end = range.end ?? todayISO(now);
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
}
