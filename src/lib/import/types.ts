// Canonical, marketplace-agnostic shape every workbook's rows get mapped
// into before grouping/aggregation — the vocabulary import_field_mappings
// rows use for `our_field`. Adding a marketplace never adds a new field
// here; it only adds rows to import_field_mappings pointing these same
// fields at that marketplace's own header names.
export interface ImportLineItem {
  poNo: string;
  city: string;
  warehouse: string;
  sku: string;
  skuDescription: string;
  poRaisedDate: string | null;
  expiryDate: string | null;
  appointmentDate: string | null;
  dispatchDate: string | null;
  orderedQty: number;
  dispatchedQty: number;
  status: string;
  dispatchWarehouse?: string;
}
