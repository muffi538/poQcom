import { parseCsv } from "./csv";

// Read access only, via Google's public CSV export endpoint — no service
// account. Confirmed tradeoff: this only works while the sheet stays
// shared as "Anyone with the link can view"; if it's ever locked down,
// this breaks until sharing is restored or a service-account path is
// added back in.
export function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

export function getConfiguredSheetId(): string | null {
  const raw = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_URL;
  return raw ? extractSheetId(raw) : null;
}

// Fetches one tab (by gid) as raw rows (array of cell strings), including
// the header row(s). Use this instead of readSheetTab when a tab has
// duplicate column names in different blocks — object-keyed rows would
// silently collapse those to whichever column came last.
export async function readSheetTabRaw(gid: string): Promise<string[][]> {
  const sheetId = getConfiguredSheetId();
  if (!sheetId) {
    throw new Error(
      "Google Sheets is not configured yet. Set GOOGLE_SHEET_URL (or GOOGLE_SHEET_ID) in .env — see Settings."
    );
  }

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to read sheet tab (gid=${gid}): HTTP ${res.status}. Confirm the sheet is shared as "Anyone with the link can view".`
    );
  }

  const text = await res.text();
  return parseCsv(text).map((row) => row.map((cell) => cell.trim()));
}

// Fetches one tab as an array of row objects keyed by the given header
// row. `headerRowIndex` accounts for cosmetic title/notice rows Google
// Sheets users often put above the real header (0-indexed). Do not use
// this for tabs with duplicate header names — see readSheetTabRaw.
export async function readSheetTab(
  gid: string,
  headerRowIndex = 0
): Promise<Record<string, string>[]> {
  const rows = await readSheetTabRaw(gid);
  const header = rows[headerRowIndex];
  if (!header) return [];

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => Object.fromEntries(header.map((col, i) => [col, row[i] ?? ""])));
}
