import { supabase } from "@/lib/supabase";
import { PurchaseOrder, PoLineItem } from "@/types/purchase-order";

// The Supabase-backed replacement for src/lib/sheets/marketplaces.ts's
// old fetchPurchaseOrders/fetchAllPurchaseOrders — same PurchaseOrder[]
// output shape (so buildPoRows/buildExecutiveSummary/computePoPriority/
// buildTopSkuTable all keep working unchanged), sourced from Supabase's
// purchase_orders/purchase_order_items instead of a live Google Sheets
// fetch. The dashboard now reads only from here — Google Sheets is a
// sync-time data source, never touched at render time.

interface PoRowFromDb {
  id: string;
  po_number: string;
  status: string;
  city: string | null;
  warehouse: string | null;
  po_raised_date: string | null;
  expiry_date: string | null;
  appointment_date: string | null;
  dispatch_date: string | null;
  ordered_qty: number;
  dispatched_qty: number;
  pending_qty: number;
  po_value: number | null;
  fill_rate: number | null;
  dispatcher_name: string | null;
  operational_dispatch_days: number | null;
  marketplaces: { name: string } | null;
}

interface ItemRowFromDb {
  purchase_order_id: string;
  sku: string;
  sku_description: string | null;
  ordered_qty: number;
  dispatched_qty: number;
  pending_qty: number;
}

const PO_SELECT =
  "id, po_number, status, city, warehouse, po_raised_date, expiry_date, appointment_date, dispatch_date, " +
  "ordered_qty, dispatched_qty, pending_qty, po_value, fill_rate, dispatcher_name, operational_dispatch_days, marketplaces(name)";

// PostgREST's .in() filter puts every id in the request URL — with
// hundreds of POs (each a 36-char uuid) that URL gets long enough to
// fail outright ("TypeError: fetch failed", confirmed against the real
// Overview page with 444 POs across Zepto + Flipkart Minutes). Chunking
// keeps each request's URL a safe length regardless of how many POs
// exist.
const ITEMS_QUERY_CHUNK_SIZE = 100;

async function fetchItemsForPoIds(poIds: string[]): Promise<ItemRowFromDb[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < poIds.length; i += ITEMS_QUERY_CHUNK_SIZE) {
    chunks.push(poIds.slice(i, i + ITEMS_QUERY_CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("purchase_order_id, sku, sku_description, ordered_qty, dispatched_qty, pending_qty")
        .in("purchase_order_id", chunk);
      if (error) throw new Error(`Failed to load purchase_order_items: ${error.message}`);
      return (data ?? []) as ItemRowFromDb[];
    })
  );
  return results.flat();
}

async function assemblePurchaseOrders(poRows: PoRowFromDb[]): Promise<PurchaseOrder[]> {
  if (poRows.length === 0) return [];

  const itemRows = await fetchItemsForPoIds(poRows.map((po) => po.id));

  const itemsByPoId = new Map<string, ItemRowFromDb[]>();
  for (const item of itemRows) {
    const group = itemsByPoId.get(item.purchase_order_id) ?? [];
    group.push(item);
    itemsByPoId.set(item.purchase_order_id, group);
  }

  return poRows.map((po) => {
    const items = itemsByPoId.get(po.id) ?? [];
    const lineItems: PoLineItem[] = items.map((item) => ({
      sku: item.sku,
      skuDescription: item.sku_description ?? "",
      orderedQty: item.ordered_qty,
      dispatchedQty: item.dispatched_qty,
      pendingQty: item.pending_qty,
    }));
    const first = lineItems[0];
    const extra = lineItems.length > 1 ? ` +${lineItems.length - 1} more` : "";

    return {
      id: po.po_number,
      marketplace: po.marketplaces?.name ?? "",
      city: po.city ?? "",
      warehouse: po.warehouse ?? "",
      sku: first ? `${first.sku}${extra}` : "",
      skuDescription: first ? `${first.skuDescription}${extra}` : "",
      skus: [...new Set(lineItems.map((l) => l.sku).filter(Boolean))],
      lineItems,
      poRaisedDate: po.po_raised_date ?? "",
      expiryDate: po.expiry_date ?? "",
      appointmentDate: po.appointment_date,
      dispatchDate: po.dispatch_date,
      orderedQty: po.ordered_qty,
      dispatchedQty: po.dispatched_qty,
      pendingQty: po.pending_qty,
      poValue: po.po_value,
      status: po.status,
      fillRate: po.fill_rate,
      dispatcherName: po.dispatcher_name,
      operationalDispatchDays: po.operational_dispatch_days,
      raw: { lineItems },
    } satisfies PurchaseOrder;
  });
}

export async function fetchPurchaseOrdersForMarketplace(marketplaceId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase.from("purchase_orders").select(PO_SELECT).eq("marketplace_id", marketplaceId);
  if (error) throw new Error(`Failed to load purchase_orders: ${error.message}`);
  return assemblePurchaseOrders((data ?? []) as unknown as PoRowFromDb[]);
}

// Marketplace pages key off the marketplace's display name (matching
// the URL slug), not its Supabase id — resolve it first, same pattern
// as loadMarketplaceNameMaps in rules/storage.ts.
export async function fetchPurchaseOrdersForMarketplaceName(marketplaceName: string): Promise<PurchaseOrder[]> {
  const { data: marketplaceRow, error: marketplaceError } = await supabase
    .from("marketplaces")
    .select("id")
    .eq("name", marketplaceName)
    .maybeSingle();
  if (marketplaceError) throw new Error(`Failed to look up marketplace "${marketplaceName}": ${marketplaceError.message}`);
  if (!marketplaceRow) return [];
  return fetchPurchaseOrdersForMarketplace(marketplaceRow.id);
}

export async function fetchAllPurchaseOrdersFromSupabase(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase.from("purchase_orders").select(PO_SELECT);
  if (error) throw new Error(`Failed to load purchase_orders: ${error.message}`);
  return assemblePurchaseOrders((data ?? []) as unknown as PoRowFromDb[]);
}
