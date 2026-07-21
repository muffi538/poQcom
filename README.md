# AI Operations Control Tower

Purchase Order priority dashboard for Zepto / Blinkit / Instamart (BigBasket
deferred — see below), built on Google Sheets. The connector, field mapping,
and data model below are wired to your real sheet and confirmed with you;
the actual **scoring** (which rules exist and what score they carry) is
still deliberately unbuilt — rules live as ops-editable data in the Rules
Builder, not in code, and none exist yet.

## What exists and is live

- Next.js + TypeScript + Tailwind app: Overview, per-marketplace dashboards,
  Rules Builder, Simulator, Settings.
- **Google Sheets connector** (`src/lib/sheets/`) — reads your sheet via
  Google's public CSV export (confirmed: no service account needed, as
  long as the sheet stays shared as "Anyone with the link can view").
  Handles:
  - Zepto / Blinkit / Instamart POs tabs, each with their own header-row
    offset and column names.
  - Forward-filling merged/blank PO-level cells and aggregating multi-SKU
    POs back up to one row per PO Number (confirmed approach).
  - PO Value = ordered qty × SKU cost price, joined from the "EAN" tab
    (confirmed: Cost Price, not MRP).
  - City derivation: Instamart's FC name is used as-is, Blinkit's FC name
    has its facility code stripped, Zepto's location code is mapped via a
    confirmed table in `src/lib/po/city.ts`.
- **Derived fields** (`src/lib/po/derived.ts`) — SLA window = Expiry − PO
  Raised (confirmed), SLA % consumed, days remaining, Is Metro City
  (against the configurable list in `src/lib/config/store.ts`), and a
  working (unconfirmed) Appointment Delay proxy — see the comment there.
- **Rule engine** (`src/lib/rules/engine.ts` + `priority.ts`) — mechanical
  evaluator with nested AND/OR groups, per-rule accumulate/override and
  stop/continue (all confirmed). Priority Level is derived purely from the
  final score via configurable thresholds (confirmed) — no rule sets a
  level directly. A PO with zero matching rules shows "Unscored", not a
  guessed default (confirmed).
- **Executive Summary** (`src/lib/dashboard/summary.ts`) — real KPIs
  computed from the live sheet: Total Active PO, Critical/High/Medium/Low/
  Unscored, Expired, Expiring Today, Pending Qty/Value, Avg Dispatch Time,
  Avg Appointment Delay, Avg SLA Consumption. "Active" excludes terminal
  statuses (Delivered, Cancel/Cancelled, RTO Done, Dispatched*, Expired —
  confirmed against the sheet's real status vocabulary).

## Where the Google Sheet link goes

`.env` (copy from `.env.example`) — already pre-filled with your sheet's
URL and the gids for the Zepto/Blinkit/Instamart POs tabs and the EAN
pricing tab. `/settings` shows connection status read-only; nothing to
paste there today.

## Confirmed but not yet implemented

- The actual rules (conditions + score deltas) — the Rules Builder page
  exists but Create/Import/Export are still disabled pending an
  interactive condition/action editor. `src/lib/rules/field-catalog.ts`
  has the confirmed field list ready for it.
- Inventory Available / Inventory Risk rules — deferred, the Inventory tab
  has visible `#N/A`/`#REF!` errors and isn't a clean per-SKU table yet.
- AI learning from historical dispatch outcomes — confirmed as phase 2,
  after the deterministic rule engine ships.
- BigBasket — its sheet tab is one block per PO with its own SKU
  line-item sub-table, structurally unlike the other three; out of scope
  until that layout gets its own parser.
- Deterministic aggregation "AI Suggestions" (dispatch plan, bottlenecks,
  etc.) — confirmed as aggregation over the rule engine's output, no LLM
  call; not yet built.

## Needs a second look

- **Appointment Delay formula** — there's no "expected appointment date"
  field in the sheet, so this currently uses `max(0, Appointment Date −
  Expiry Date)` as a working proxy. Flag before it drives real scoring.
- **Pending Qty** = Ordered Qty − Dispatched Qty, treating an absent
  Dispatched Qty column (Zepto) as 0. Worth confirming against how Zepto
  actually tracks partial dispatch.

## Running it

```
npm install
cp .env.example .env   # already points at your sheet — no service account needed
npm run dev
```
