import * as XLSX from "xlsx";

// Converts one tab of an uploaded Excel workbook into the same
// string[][] raw-row shape a Google Sheets CSV export produces, so every
// downstream importer (po/sales/dispatch) treats both sources
// identically — only this function needs to know Excel exists.
//
// Two failure modes a CSV export never has, both handled here:
//   - Large numeric IDs (PO/shipment numbers) render as scientific
//     notation in Excel's *display* string (e.g. "5.00332E+13") while
//     the underlying cell keeps full precision — read the raw value,
//     never the formatted one, or matching against Supabase silently
//     breaks for exactly the POs that need it least visibly.
//   - Dates are stored as serial numbers, not text — reformatted here as
//     m/d/yyyy (via cellDates) so parseSheetDate's existing regex works
//     unchanged regardless of which source a row came from.
export function readWorkbookSheetRaw(buffer: Buffer, sheetName?: string): string[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = sheetName ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[name];
  if (!sheet) {
    throw new Error(`Sheet "${name}" not found in workbook. Available sheets: ${workbook.SheetNames.join(", ")}`);
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const rows: string[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cellToString(cell));
    }
    rows.push(row);
  }
  return rows;
}

export function listWorkbookSheetNames(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer", bookSheets: true });
  return workbook.SheetNames;
}

function cellToString(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  if (cell.v instanceof Date) {
    const d = cell.v;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  }
  if (typeof cell.v === "number") return String(cell.v);
  return String(cell.v).trim();
}
