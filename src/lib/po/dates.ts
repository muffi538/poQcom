// A month/day pair with either component out of range (e.g. a d/m/y
// value fed to the m/d/y parser, or vice versa) must never silently
// become a rolled-over Date — new Date(y, 25, 6) doesn't throw, it just
// advances to a wildly wrong future date/year, which is worse than
// returning null (confirmed by a real bug: the Dispatch sheet's "26/6/2026"
// read as m/d/y gave "month 26" and silently rolled forward to
// 2028-02-06). Reject out-of-range components instead of constructing
// the Date at all.
function buildDate(year: number, month1To12: number, day: number): string | null {
  if (month1To12 < 1 || month1To12 > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month1To12 - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  // Catches the remaining case range-checks above can't (e.g. day 31 in a
  // 30-day month) — a valid-looking date that still overflowed.
  if (date.getMonth() !== month1To12 - 1) return null;
  return date.toISOString().slice(0, 10);
}

// Sheet dates are m/d/yyyy (US-style — confirmed by values like "9/19/2025",
// where 19 can't be a month, so day comes second). Returns ISO yyyy-mm-dd,
// or null when a cell is blank or genuinely unparseable (e.g. Blinkit's
// occasional "2 June" with no year) — confirmed to just leave those rows
// with no appointment date rather than guessing.
export function parseSheetDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  return buildDate(Number(year), Number(month), Number(day));
}

// d/m/yyyy variant — confirmed needed for the Dispatch sheet specifically
// (its "Dispatched Date" column exports as "26/6/2026", day first; unlike
// every PO/Sales sheet, which is m/d/yyyy). Each Google Sheet's date
// column format is set by that sheet's own locale, not shared across
// sheets, so this is a real per-source difference, not a parsing choice.
export function parseSheetDateDayFirst(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return buildDate(Number(year), Number(month), Number(day));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
