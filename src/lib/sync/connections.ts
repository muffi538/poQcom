import { supabase } from "@/lib/supabase";
import { WorkbookType } from "@/lib/import/field-mappings";

export interface SheetConnection {
  id: string;
  workbookType: WorkbookType;
  marketplaceId: string | null;
  sheetUrl: string;
  gid: string | null;
  headerRowIndex: number;
  autoDetectHeader: boolean;
  requiredColumns: string[] | null;
  isEnabled: boolean;
  minPoRaisedYear: number | null;
}

function rowToConnection(row: {
  id: string;
  workbook_type: string;
  marketplace_id: string | null;
  sheet_url: string;
  gid: string | null;
  header_row_index: number;
  auto_detect_header: boolean;
  required_columns: string[] | null;
  is_enabled: boolean;
  min_po_raised_year: number | null;
}): SheetConnection {
  return {
    id: row.id,
    workbookType: row.workbook_type as WorkbookType,
    marketplaceId: row.marketplace_id,
    sheetUrl: row.sheet_url,
    gid: row.gid,
    headerRowIndex: row.header_row_index,
    autoDetectHeader: row.auto_detect_header,
    requiredColumns: row.required_columns,
    isEnabled: row.is_enabled,
    minPoRaisedYear: row.min_po_raised_year,
  };
}

// Looks up this marketplace's own tab first (today's real shape for PO),
// falling back to the one shared connection for this workbook_type
// (today's real shape for Sales/Dispatch/EAN — a single tab covering
// every marketplace via its own filter column). Returns null rather than
// throwing when nothing is configured yet — callers decide whether that's
// a hard failure or just "nothing to sync".
export async function loadSheetConnection(workbookType: WorkbookType, marketplaceId?: string): Promise<SheetConnection | null> {
  if (marketplaceId) {
    const { data, error } = await supabase
      .from("sheet_connections")
      .select("id, workbook_type, marketplace_id, sheet_url, gid, header_row_index, auto_detect_header, required_columns, is_enabled, min_po_raised_year")
      .eq("workbook_type", workbookType)
      .eq("marketplace_id", marketplaceId)
      .eq("is_enabled", true)
      .maybeSingle();
    if (error) throw new Error(`Failed to load ${workbookType} sheet connection: ${error.message}`);
    if (data) return rowToConnection(data);
  }

  const { data: shared, error: sharedError } = await supabase
    .from("sheet_connections")
    .select("id, workbook_type, marketplace_id, sheet_url, gid, header_row_index, auto_detect_header, required_columns, is_enabled, min_po_raised_year")
    .eq("workbook_type", workbookType)
    .is("marketplace_id", null)
    .eq("is_enabled", true)
    .maybeSingle();
  if (sharedError) throw new Error(`Failed to load shared ${workbookType} sheet connection: ${sharedError.message}`);
  return shared ? rowToConnection(shared) : null;
}
