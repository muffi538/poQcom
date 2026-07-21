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
- **Derived fields** (`src/lib/po/derived.ts`) — days remaining, Is Metro
  City (against the configurable list in `src/lib/config/store.ts`), and
  **Operational Delay** (confirmed, replaces SLA % consumed entirely) =
  today − expiry date, only for non-Delivered POs with a real expiry
  date. Positive = days late, 0 = due today, negative = days remaining,
  null = "Unknown" (Delivered PO or blank expiry date — never fabricated).
  Also flags `hasDataError` (PO Raised Date after Expiry Date) and
  `appointmentScheduledTooLate` (Appointment Date after Expiry Date). The
  Appointment-vs-Expiry gap is kept separately as `appointmentDelayDays`
  for the existing confirmed rule — a different question from Operational
  Delay (appointment booked late vs. the PO itself being overdue today).
- **Rule engine** (`src/lib/rules/engine.ts` + `priority.ts`) — mechanical
  evaluator with nested AND/OR groups, per-rule accumulate/override and
  stop/continue (all confirmed). Priority Level is derived purely from the
  final score via configurable thresholds (Critical ≥80, High ≥60, Medium
  ≥30, Low below — confirmed starting defaults). A PO with zero matching
  rules shows "Unscored", not a guessed default (confirmed).
- **Starter rules** (`src/lib/rules/seed-rules.ts`) — five rules, each
  confirmed with real score deltas. Evaluated first: **Expired Pending PO**
  (+100) — a PO past its own expiry date and still not Delivered, alone
  enough to cross the Critical threshold, per the confirmed "should
  override almost every other rule" behavior (still score-derived, not a
  rule-forced level — see above). Then Metro City Bonus (+10), Metro City
  Nearing Expiry (+35, only while not yet overdue), Blinkit Expiring
  Tomorrow (+50), Appointment Delay (+25). These are data, not engine
  code — they live in the same rules store the Rules Builder reads/
  writes, and are only the storage's fallback default until real rules
  are saved.
- **Control Tower** (`src/components/dashboard/po-control-tower.tsx`) —
  every active PO as its own ranked row: score, level, marketplace, dates,
  qty, value, days remaining, Operational Delay, appointment delay, metro
  flag, rules triggered, recommended action. Already-overdue rows get a
  red left border and a pulsing warning icon. Filters (marketplace/city/
  priority/metro/overdue-only/critical-only/search), 8 sort modes
  (including "Most Overdue"), a click-through detail panel (full PO info,
  every SKU on it, timeline, an always-real "Why this priority" list that
  blends factual highlights — days late, city, qty, value — with
  whichever rules fired), and rule-independent sections (Expired Pending
  POs, Expiring Soon, Today's Dispatch Queue, Delayed Appointments, Metro
  City Queue, Low Value Orders). Deliberately does **not** include a Safe-
  to-Postpone section or a Priority/Risk-distribution chart yet — those
  need the engine's real judgment across more confirmed rules than the
  five seeded so far.
- **Charts** (`src/components/dashboard/po-charts.tsx`) — Expiry Timeline,
  PO Value by Marketplace, Pending Qty by City, Avg Days Late by
  Marketplace (overdue POs only). Built to the dataviz skill's method
  (fixed categorical hue per marketplace, single sequential hue for plain
  magnitude charts).
- **Executive Summary** (`src/lib/dashboard/summary.ts`) — real KPIs:
  Total Active PO, Expired Pending POs, Critical/High/Medium/Low/
  Unscored, Expired (Status), Expiring Today, Expiring Tomorrow, Pending
  Qty/Value, Avg Dispatch Time, Avg Appointment Delay, Avg Days Late
  (among currently-overdue POs).
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
  marketplace/status/priority pill badges, inline Operational Delay
  indicators.
- Lucide icons throughout; loading skeletons (`app/loading.tsx`,
  `marketplaces/[marketplace]/loading.tsx`) for the data-fetching routes.
- Manual Light/Dark/System toggle in the sidebar (`src/components/theme/`)
  — defaults to OS preference, overridable and persisted in
  `localStorage`, applied via a blocking inline script so there's no
  flash of the wrong theme on load. Dark mode itself is unchanged visually
  — charcoal, not pure black.
- Deliberately not built in this pass (real functionality, not just
  styling, so out of scope for "don't change functionality"): saved
  views, column pinning, CSV/PDF export, expandable rows. Flag if you
  want those built next.

## Density pass (enterprise grid layout)

Rebuilt the Control Tower table around a hard column-width budget
(`COL` in `po-control-tower.tsx`) via `<colgroup>` + `table-layout:
fixed`, instead of letting content push columns wider — verified at
1920×1080 with **zero horizontal scroll** (table's scrollWidth ==
clientWidth). Sticky columns: rank, Priority, PO Number, Marketplace
(cumulative `left` offsets computed from the column widths, not
guessed). Long text (FC/warehouse name, the Reason/Action column)
truncates with `title=` for the full value on hover. Row height/font
dropped to ~12px text with ~4-6px padding — about 30 rows visible per
screen on a 1080p monitor.

The old big "Expiring Soon / Metro Queue / Low Value Orders" section
cards are gone — replaced with compact toggle chips in the filter
toolbar (each shows a live count, click to filter the table itself, no
separate list to maintain). Expired POs / Needs Review / charts are
tucked behind a collapsed `<details>` disclosure below the main table,
so by default the KPI strip + filters + table take up the page, per the
requested "KPI strip → filters → full-width table" hierarchy.

KPI cards shrunk ~55% (126px→118px wide, single line of text, hover
tooltip on the label) and the sidebar narrowed (240px→176px expanded,
64px→48px collapsed) to give the table more room.

**Not built in this pass** (genuine new functionality, not layout):
Excel-style column resize-by-drag, keyboard grid navigation
(arrow-key cell movement), column pinning beyond the fixed sticky set,
CSV/PDF export. Sorting, filtering, and click-to-drill-in already work.

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
- Safe to Postpone / Priority & Risk-distribution charts — need more
  confirmed rules before they'd say anything real.
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
  urgency (several are already tens of days overdue by Operational Delay)
  — worth confirming whether it should be treated like Pending for
  scoring, kept separate, or something else entirely.

## Running it

```
npm install
cp .env.example .env   # already points at your sheet — no service account needed
npm run dev
```
