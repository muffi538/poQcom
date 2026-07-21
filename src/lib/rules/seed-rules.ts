import { Rule } from "@/types/rules";

// Starter rules, confirmed rule-by-rule (score deltas included) against
// the original example rules. This is a seed dataset for the Rules
// Builder's storage, not engine logic — every value here is editable/
// deletable through the (forthcoming) Rules Builder UI once it's
// interactive; storage.ts falls back to this list only until a real
// rules.json exists.
//
// Deliberately NOT seeded yet (still need confirmed numbers or blocked
// on data): Inventory Risk / "PO Value < 25000 AND Inventory Low" (both
// depend on the deferred Inventory tab), Warehouse=Mumbai AND Pending
// Qty>1000 (Warehouse Risk — score not yet confirmed), Supplier rules
// (dropped — no supplier concept in this data).
const now = "2026-07-21T00:00:00.000Z";

export const SEED_RULES: Rule[] = [
  {
    id: "seed-metro-bonus",
    name: "Metro City Bonus",
    description: "Standing +10 for any PO in a configured metro city (Settings > metro list).",
    enabled: true,
    order: 10,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-metro-bonus-root",
      join: "AND",
      children: [{ id: "seed-metro-bonus-c1", field: "isMetroCity", operator: "equals", value: true }],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 10,
      addFlags: [],
      reason: "Metro city",
      recommendedAction: "",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
  {
    id: "seed-metro-near-expiry",
    name: "Metro City Nearing Expiry",
    description: "Metro city PO with 2 days or less remaining before expiry.",
    enabled: true,
    order: 20,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-metro-near-expiry-root",
      join: "AND",
      children: [
        { id: "seed-metro-near-expiry-c1", field: "isMetroCity", operator: "equals", value: true },
        { id: "seed-metro-near-expiry-c2", field: "daysRemaining", operator: "less_than_or_equal", value: 2 },
      ],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 35,
      addFlags: [],
      reason: "Metro city nearing expiry",
      recommendedAction: "Dispatch immediately — expires within 2 days in a metro city.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
  {
    id: "seed-sla-breach",
    name: "SLA Breach Risk",
    description: "SLA already over 80% consumed with a large pending quantity.",
    enabled: true,
    order: 30,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-sla-breach-root",
      join: "AND",
      children: [
        { id: "seed-sla-breach-c1", field: "slaConsumedPercent", operator: "greater_than", value: 80 },
        { id: "seed-sla-breach-c2", field: "pendingQty", operator: "greater_than", value: 50 },
      ],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 50,
      addFlags: ["SLA Risk"],
      reason: "SLA already over 80% consumed with high pending quantity",
      recommendedAction: "Escalate — SLA breach risk with large pending quantity.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
  {
    id: "seed-blinkit-expiry-tomorrow",
    name: "Blinkit Expiring Tomorrow",
    description: "Blinkit PO expiring tomorrow.",
    enabled: true,
    order: 40,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-blinkit-expiry-tomorrow-root",
      join: "AND",
      children: [
        { id: "seed-blinkit-expiry-tomorrow-c1", field: "marketplace", operator: "equals", value: "Blinkit" },
        { id: "seed-blinkit-expiry-tomorrow-c2", field: "daysRemaining", operator: "equals", value: 1 },
      ],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 50,
      addFlags: [],
      reason: "Blinkit PO expires tomorrow",
      recommendedAction: "Dispatch immediately — expires tomorrow.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
  {
    id: "seed-appointment-delay",
    name: "Appointment Delay",
    description: "Appointment scheduled more than 2 days past the PO's expiry.",
    enabled: true,
    order: 50,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-appointment-delay-root",
      join: "AND",
      children: [
        { id: "seed-appointment-delay-c1", field: "appointmentDelayDays", operator: "greater_than", value: 2 },
      ],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 25,
      addFlags: ["Operational Delay"],
      reason: "Appointment scheduled more than 2 days late",
      recommendedAction: "Flag for operations follow-up — appointment delay compounding risk.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
];
