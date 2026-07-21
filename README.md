# AI Operations Control Tower

Purchase Order priority dashboard for Zepto / Blinkit / Instamart (BigBasket
deferred — see below), built on Google Sheets. The connector, field mapping,
data model, and a starter rule set below are all wired to your real sheet
and confirmed with you — this is a working control tower with real scores,
not a demo.

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
  - City derivation, normalized to consistent Title Case across
    marketplaces (Instamart's raw names are ALL CAPS) so totals don't
    silently split — see `src/lib/po/city.ts`. Known gap: Zepto maps its
    code to "Bangalore" while Blinkit's raw data says "Bengaluru" — these
    still show as two separate cities; ask before merging aliases.
- **Derived fields** (`src/lib/po/derived.ts`) — SLA window = Expiry − PO
  Raised (confirmed), SLA % consumed, days remaining, Is Metro City
  (against the configurable list in `src/lib/config/store.ts`), and a
  working (unconfirmed) Appointment Delay proxy — see the comment there.
- **Rule engine** (`src/lib/rules/engine.ts` + `priority.ts`) — mechanical
  evaluator with nested AND/OR groups, per-rule accumulate/override and
  stop/continue (all confirmed). Priority Level is derived purely from the
  final score via configurable thresholds (Critical ≥80, High ≥60, Medium
  ≥30, Low below — confirmed starting defaults). A PO with zero matching
  rules shows "Unscored", not a guessed default (confirmed).
- **Starter rules** (`src/lib/rules/seed-rules.ts`) — five rules, each
  confirmed with real score deltas: Metro City Bonus (+10), Metro City
  Nearing Expiry (+35), SLA Breach Risk (+50), Blinkit Expiring Tomorrow
  (+50), Appointment Delay (+25). These are data, not engine code — they
  live in the same rules store the Rules Builder reads/writes, and are
  only the storage's fallback default until real rules are saved.
- **Control Tower** (`src/components/dashboard/po-control-tower.tsx`) —
  every active PO as its own ranked row: score, level, marketplace, dates,
  qty, value, days remaining, SLA%, delay, metro flag, rules triggered,
  recommended action. Filters (marketplace/city/priority/metro/critical-
  only/search), 8 sort modes, a click-through detail panel (full PO info,
  every SKU on it, timeline, rule explanations), and rule-independent
  sections (Expiring Soon, Today's Dispatch Queue, Delayed Appointments,
  Metro City Queue, Low Value Orders). Deliberately does **not** include a
  Critical Action Queue, Safe-to-Postpone, or Priority/Risk charts yet —
  those need the engine's real judgment across more confirmed rules, not
  just the five seeded so far.
- **Charts** (`src/components/dashboard/po-charts.tsx`) — Expiry Timeline,
  PO Value by Marketplace, Pending Qty by City, Avg Operational Delay by
  Marketplace. Built to the dataviz skill's method (fixed categorical hue
  per marketplace, single sequential hue for plain magnitude charts).
- **Executive Summary** (`src/lib/dashboard/summary.ts`) — real KPIs:
  Total Active PO, Critical/High/Medium/Low/Unscored, Expired, Expiring
  Today, Pending Qty/Value, Avg Dispatch Time, Avg Appointment Delay, Avg
  SLA Consumption.
- **Status routing** (`classifyStatus` in `src/types/purchase-order.ts`,
  confirmed) — only Status = "Pending" runs through the priority scoring
  chain and appears in the ranked Control Tower table. "Expired" and
  "Needs Review" (any other non-terminal status — Price issue, Scheduled,
  Revised appt. required) get their own read-only sections instead of
  being scored alongside Pending. Delivered/Cancel/Cancelled/RTO
  Done/Dispatched*/"Low Value Cant Dispatch" are excluded everywhere.
  "Needs Review" is real unclassified ground, not a guess — see below.

## Design system

Full visual redesign, no functional changes — same data/filters/sorting,
new look:
- **Inter** font, Frido brand identity on Overview/shared pages (yellow
  `#FFD400` / black), collapsible sidebar with marketplace nav
  (`src/components/layout/sidebar.tsx`).
- **Per-marketplace theming** (`src/lib/theme/marketplace-colors.ts` +
  `MarketplaceThemeScope`) — Zepto purple, Blinkit yellow/black, Instamart
  orange (Flipkart/Myntra/Amazon/FBF/E-Trade colors seeded for later).
  Visiting a marketplace page recolors its KPI icons, buttons, badges, and
  single-series charts to that marketplace's brand color via CSS
  variables (`--mp-primary` / `--mp-accent`) — no per-component branching.
- Glass-style cards (`.glass-card`, `.card-elevate` in `globals.css`),
  rounded-18px corners, hover lift, soft shadows.
- Gradient/animated bar charts, sticky table header + first column,
  marketplace/status/priority pill badges, inline SLA progress bars.
- Lucide icons throughout; loading skeletons (`app/loading.tsx`,
  `marketplaces/[marketplace]/loading.tsx`) for the data-fetching routes.
- Dark mode unchanged in behavior (already `prefers-color-scheme`-based)
  but restyled to match — charcoal, not pure black.
- Deliberately not built in this pass (real functionality, not just
  styling, so out of scope for "don't change functionality"): saved
  views, column pinning, CSV/PDF export, expandable rows. Flag if you
  want those built next.

## Where the Google Sheet link goes

`.env` (copy from `.env.example`) — already pre-filled with your sheet's
URL and the gids for the Zepto/Blinkit/Instamart POs tabs and the EAN
pricing tab. `/settings` shows connection status read-only; nothing to
paste there today.

## Confirmed but not yet implemented

- **Interactive Rules Builder** — Create/Edit/Import/Export/drag-reorder
  are still disabled; `/rules-builder` lists the current rules read-only
  with a plain-English breakdown of each one. `src/lib/rules/field-
  catalog.ts` has the confirmed field list ready for when this gets built.
- More rules — only 5 of your original examples are seeded. Still open:
  Inventory Risk / "PO Value < 25000 AND Inventory Low" (blocked on the
  Inventory tab), Warehouse=Mumbai AND Pending Qty>1000 Warehouse Risk
  (score not yet confirmed). Supplier rules were dropped entirely — no
  supplier concept in this data (confirmed).
- Critical Action Queue / Safe to Postpone / Priority & Risk charts — need
  more confirmed rules before they'd say anything real.
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
  Expiry Date)` as a working proxy. Flag before trusting it further.
- **Pending Qty** = Ordered Qty − Dispatched Qty, treating an absent
  Dispatched Qty column (Zepto) as 0. Worth confirming against how Zepto
  actually tracks partial dispatch.
- **City aliases** — "Bangalore" (Zepto) vs "Bengaluru" (Blinkit) currently
  stay separate; say the word if they should merge.
- **"Needs Review" statuses** — currently Scheduled, Price issue, and
  Revised appt. required all sit outside the priority chain (50 POs on
  the live sheet, mostly Scheduled). Scheduled in particular has real
  urgency (SLA% well past 100% on several) — worth confirming whether it
  should be treated like Pending for scoring, kept separate, or something
  else entirely.

## Running it

```
npm install
cp .env.example .env   # already points at your sheet — no service account needed
npm run dev
```
