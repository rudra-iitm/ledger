import { CATEGORIES, type Category } from "./types";
import {
  TIME_PRESET_LABELS,
  type TimePreset,
} from "./time-ranges";

/**
 * Deterministic interpreter for natural search phrases: "food last month",
 * "amazon this year", "bills yesterday" compile to structured expense
 * filters that deep-link straight into the expenses view.
 */

export interface SmartQuery {
  category?: Category;
  preset?: TimePreset;
  /** Remaining free-text after structured tokens are consumed. */
  query: string;
  /** Human-readable summary, e.g. "Food · Last Month". */
  label: string;
}

const PRESET_PHRASES: [string, TimePreset][] = [
  ["today", "today"],
  ["yesterday", "yesterday"],
  ["last 7 days", "last7"],
  ["last week", "lastWeek"],
  ["this week", "thisWeek"],
  ["last month", "lastMonth"],
  ["this month", "thisMonth"],
  ["this year", "thisYear"],
  ["last fy", "lastFY"],
  ["this fy", "thisFY"],
  ["last financial year", "lastFY"],
  ["this financial year", "thisFY"],
];

export function interpretSearch(input: string): SmartQuery | null {
  let text = ` ${input.trim().toLowerCase().replace(/\s+/g, " ")} `;
  if (text.trim().length === 0) return null;

  let preset: TimePreset | undefined;
  for (const [phrase, value] of PRESET_PHRASES) {
    const needle = ` ${phrase} `;
    if (text.includes(needle)) {
      preset = value;
      text = text.replace(needle, " ");
      break;
    }
  }

  let category: Category | undefined;
  for (const candidate of CATEGORIES) {
    const needle = ` ${candidate.toLowerCase()} `;
    if (text.includes(needle)) {
      category = candidate;
      text = text.replace(needle, " ");
      break;
    }
  }

  // Nothing structured recognized — plain text search handles it already.
  if (!preset && !category) return null;

  const query = text.trim();
  const parts = [
    category,
    preset ? TIME_PRESET_LABELS[preset] : undefined,
    query ? `“${query}”` : undefined,
  ].filter(Boolean);

  return { category, preset, query, label: parts.join(" · ") };
}
