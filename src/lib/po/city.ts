// City derivation per marketplace, based on the real column formats found
// in the connected sheet (confirmed with the user, not guessed):
//   - Instamart "FC name" is already a clean city name, but in ALL CAPS
//     (e.g. "BANGALORE").
//   - Blinkit "FC name" embeds a city plus a facility code, e.g.
//     "Pune P3 - Feeder Warehouse" or "Mumbai M10 - Feeder Warehouse".
//   - Zepto "Del Location" is a short code prefix, e.g. "MUM-SS-MH-SHAKTI".
//     The prefix -> city table below is user-confirmed and stored as data
//     so new codes can be appended without a code change.
//
// All three are normalized to Title Case at the end so "Bangalore"
// (Zepto/Blinkit) and "BANGALORE" (Instamart) aggregate as the same city
// instead of splitting grouped totals/charts/filters in two.
export const ZEPTO_CITY_CODES: Record<string, string> = {
  BLR: "Bangalore",
  CHN: "Chennai",
  GUR: "Gurgaon",
  JJR: "Jhajjar",
  JPR: "Jaipur",
  MUM: "Mumbai",
};

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function cityFromZeptoLocation(delLocation: string): string {
  const prefix = delLocation.split("-")[0]?.trim().toUpperCase();
  const city = (prefix && ZEPTO_CITY_CODES[prefix]) || delLocation;
  return toTitleCase(city);
}

// Strips a trailing facility code token (e.g. "P3", "M10", "B5") and any
// " - Feeder Warehouse"-style suffix from a Blinkit FC name.
export function cityFromBlinkitFcName(fcName: string): string {
  const beforeDash = fcName.split(" - ")[0]?.trim() ?? fcName;
  const withoutCode = beforeDash.replace(/\s+[A-Za-z]{1,3}\d+$/, "").trim();
  return toTitleCase(withoutCode || fcName);
}

export function cityFromInstamartFcName(fcName: string): string {
  return toTitleCase(fcName.trim());
}
