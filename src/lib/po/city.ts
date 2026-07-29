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

// Amazon Now "Location" is "<facility code> - <City>, <STATE>", e.g.
// "HKA2 - BENGALURU, KARNATAKA" or "HHR7 - Sonipat, HARYANA" (confirmed
// against the real sheet, 2026-07-25).
export function cityFromAmazonNowLocation(location: string): string {
  const afterDash = location.split(" - ")[1]?.trim() ?? location;
  const city = afterDash.split(",")[0]?.trim() ?? afterDash;
  return toTitleCase(city || location);
}

// BigBasket "Location" is usually "<City>-<facility code>", e.g.
// "Chennai-FMCG-DC", "Hyderabad-FV-FMCG DC", "Bangalore-2-FV-FMCG-DC",
// "Delhi-DC" — except a handful of warehouses that put a "WMS" facility
// prefix ahead of the city instead, e.g. "WMS-Bangalore-FC2" (confirmed
// against the real "Bigbasket" tab, 2026-07-27).
export function cityFromBigBasketLocation(location: string): string {
  const parts = location.split("-").map((p) => p.trim()).filter(Boolean);
  const city = parts[0]?.toUpperCase() === "WMS" ? parts[1] : parts[0];
  return toTitleCase(city || location);
}

// E-trade's sheet has two identically-named "Location " columns (both
// literally "Location " — confirmed byte-identical, 2026-07-29); the
// FIRST is blank on every single row, and the SECOND holds the real
// value, e.g. "DEL6 - Gurgaon, HARYANA", "HYD8-Hyderabad, Telangana",
// or occasionally just a bare code like "PNQ3" or "SHYL" with no city/
// state suffix at all. The mapping targets the second occurrence via
// extractRowsByHeader's "<name> (#2)" synthetic key. Formatting of the
// suffix is inconsistent (" - ", "- ", "-", or nothing) so rather than
// splitting on a dash like Amazon Now/BigBasket, this extracts the
// leading alphanumeric code and looks it up here, same pattern as
// Zepto's ZEPTO_CITY_CODES. Table built from the real sheet's full
// Location column (2026-07-29); codes not in this table fall back to
// the raw value rather than fabricating a city.
export const ETRADE_CITY_CODES: Record<string, string> = {
  AMD2: "Ahmedabad",
  BBX1: "Bhubaneswar",
  BL01: "Bengaluru",
  BLR4: "Bengaluru",
  BLR7: "Bangalore",
  BLR8: "Bengaluru",
  BLX1: "Bangalore",
  BLX9: "Bangalore Rural",
  BOM5: "Thane",
  BOM7: "Bhiwandi",
  BOX9: "Bhiwandi",
  CCX1: "Howrah",
  CCX2: "Kolkata",
  CCX4: "Serampore",
  CJB1: "Coimbatore",
  DED3: "Gurgaon",
  DED4: "Gurgaon",
  DED5: "Gurugram",
  DEL4: "Gurgaon",
  DEL5: "Gurgaon",
  DEL6: "Gurgaon",
  DEX3: "New Delhi",
  FBE2: "Kolar",
  FBO5: "Thane",
  FCC3: "Panchla",
  FDL5: "Gurugram",
  FHY3: "Hyderabad",
  GAX1: "Guwahati",
  HBL9: "Bengaluru",
  HBX1: "Gurugram",
  HBX2: "Hyderabad",
  HDO3: "Gurugram",
  HDX1: "Gurugram",
  HNR4: "Dadri Toe",
  HYD3: "Hyderabad",
  HYD8: "Hyderabad",
  HYX1: "Hyderabad",
  IDX2: "Indore",
  ISK3: "Bhiwandi",
  LDX1: "Rajpura",
  LKO1: "Lucknow",
  MAA4: "Thiruvalluvar",
  NAX1: "Nagpur",
  PNQ2: "New Delhi",
  PNQ3: "Chakan",
  SBLU: "Bengaluru",
  SBOB: "Bhiwandi",
  SDEG: "Gurugram",
  SHDZ: "Gurugram",
  SHYH: "Hyderabad",
};

export function cityFromEtradeLocation(warehouse: string): string {
  const trimmed = warehouse.trim();
  const codeMatch = trimmed.match(/^[A-Za-z0-9]+/);
  const code = codeMatch ? codeMatch[0].toUpperCase() : "";
  const city = ETRADE_CITY_CODES[code] || trimmed;
  return toTitleCase(city);
}
