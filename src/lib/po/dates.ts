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
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}
