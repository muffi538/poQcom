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
// (dropped — no supplier concept in this data), Expiry-approaching /
// High-Value / High-Qty / Marketplace-priority as standalone rules (no
// confirmed numbers yet beyond what's already seeded below).
const now = "2026-07-21T00:00:00.000Z";

export const SEED_RULES: Rule[] = [
  // Evaluated first (lowest order): a PO that's already past its own
  // expiry date and still not Delivered is an operational failure the
  // company has already missed its commitment on — this alone crosses
  // the Critical threshold (>=80) regardless of what else applies, per
  // the confirmed "should override almost every other rule" behavior.
  // Modeled as a very large accumulate score (not a rule-forced level —
  // level stays purely score-derived, per the earlier confirmed design)
  // and does NOT stop lower rules, so Metro/Appointment reasons still
  // stack into the same explanation.
  {
    id: "seed-expired-pending",
    name: "Expired Pending PO",
    description:
      "PO has passed its own expiry date and is still not Delivered — SLA % was retired in favor of this.",
    enabled: true,
    order: 5,
    groupId: null,
    scope: { marketplaces: "all" },
    conditions: {
      id: "seed-expired-pending-root",
      join: "AND",
      children: [{ id: "seed-expired-pending-c1", field: "isOverdue", operator: "equals", value: true }],
    },
    action: {
      scoreMode: "accumulate",
      scoreDelta: 100,
      addFlags: ["Expired Pending"],
      reason: "PO has passed its expiry date and is still outstanding",
      recommendedAction:
        "Immediate dispatch required. Escalate to warehouse and marketplace operations — high risk of cancellation or penalty.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
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
    description: "Metro city PO with 0-2 days remaining before expiry (not yet overdue — see Expired Pending PO for that).",
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
        { id: "seed-metro-near-expiry-c3", field: "daysRemaining", operator: "greater_than_or_equal", value: 0 },
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
      addFlags: ["Appointment Scheduled Late"],
      reason: "Appointment scheduled more than 2 days past expiry",
      recommendedAction: "Flag for operations follow-up — appointment delay compounding risk.",
    },
    onMatch: "continue",
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    version: 1,
  },
];
