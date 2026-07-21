import { google } from "googleapis";

// Accepts either a bare Sheet ID or a full Google Sheets URL, since ops
// users will paste whatever's in their browser address bar.
export function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : urlOrId.trim();
}

export function getConfiguredSheetId(): string | null {
  const raw = process.env.GOOGLE_SHEET_ID || process.env.GOOGLE_SHEET_URL;
  return raw ? extractSheetId(raw) : null;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// Reads one range as an array of row objects keyed by the header row.
// This is intentionally the only sheet-reading primitive in the app —
// marketplace-specific fetchers (see marketplaces.ts) all go through it,
// so there's one place to add caching / rate limiting / retry later.
export async function readSheetRange(
  range: string
): Promise<Record<string, string>[]> {
  const sheetId = getConfiguredSheetId();
  const auth = getAuth();
  if (!sheetId || !auth) {
    throw new Error(
      "Google Sheets is not configured yet. Set GOOGLE_SHEET_URL (or GOOGLE_SHEET_ID) and the service account credentials in .env — see Settings."
    );
  }

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const [header, ...rows] = res.data.values ?? [];
  if (!header) return [];

  return rows.map((row) =>
    Object.fromEntries(header.map((col, i) => [col, row[i] ?? ""]))
  );
}
