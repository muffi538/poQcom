import { FieldDefinition } from "@/types/rules";
import { MARKETPLACES } from "@/types/marketplace";

// The condition field catalog for the Rules Builder — every field a
// condition can reference, confirmed against the real sheet columns and
// the derived fields the priority engine computes. Inventory Available is
// deliberately absent (deferred pending the Inventory tab cleanup), and
// there's no Supplier field (confirmed: single supplier, doesn't vary
// per PO).
export const FIELD_CATALOG: FieldDefinition[] = [
  { key: "marketplace", label: "Marketplace", type: "enum", enumOptions: [...MARKETPLACES], source: "sheet" },
  { key: "city", label: "City", type: "string", source: "derived" },
  { key: "warehouse", label: "Warehouse / FC", type: "string", source: "sheet" },
  { key: "status", label: "Status", type: "string", source: "sheet" },
  { key: "sku", label: "SKU", type: "string", source: "sheet" },

  { key: "poRaisedDate", label: "PO Raised Date", type: "date", source: "sheet" },
  { key: "expiryDate", label: "Expiry Date", type: "date", source: "sheet" },
  { key: "appointmentDate", label: "Appointment Date", type: "date", source: "sheet" },
  { key: "dispatchDate", label: "Dispatch Date", type: "date", source: "sheet" },

  { key: "orderedQty", label: "Ordered Qty", type: "number", source: "sheet" },
  { key: "dispatchedQty", label: "Dispatched Qty", type: "number", source: "sheet" },
  { key: "pendingQty", label: "Pending Qty", type: "number", source: "sheet" },
  { key: "poValue", label: "PO Value", type: "number", source: "derived" },

  { key: "daysRemaining", label: "Days Remaining", type: "number", source: "derived" },
  // SLA % consumed retired (confirmed misleading) — Operational Delay is
  // the replacement: today minus expiry date, for any non-Delivered PO
  // with a real expiry date. Positive = days late.
  { key: "operationalDelayDays", label: "Operational Delay (days late)", type: "number", source: "derived" },
  { key: "isOverdue", label: "Is Overdue (expired but not Delivered)", type: "boolean", source: "derived" },
  { key: "appointmentDelayDays", label: "Appointment Delay (days)", type: "number", source: "derived" },
  { key: "isMetroCity", label: "Is Metro City", type: "boolean", source: "derived" },
];
