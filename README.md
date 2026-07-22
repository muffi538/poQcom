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

## Demand Intelligence Engine

A second data source — SKU-level sales (Platform, Category, Sub-Category,
Master SKU, SKU ID, Product, GMV, Units, ASP, Spend, TACoS%) — now feeds
into PO priority. Objective (confirmed): demand should influence dispatch
priority, so a PO containing a marketplace's best-selling SKU outranks an
otherwise-identical PO for a slow mover.

- **Sheet structure** (confirmed, after weighing separate-tabs vs.
  separate-workbook): a **separate Google Sheet** (`SALES_SHEET_URL` in
  `.env`), not additional tabs in the PO workbook — the sales data has a
  different owner/update cadence and no PO-specific columns to share.
  Read the same way as the PO sheet (public CSV export, no service
  account). Single "Product Summary" tab.
- **Match key** (confirmed, verified against the real sheets): each PO
  tab's `SKU` column already holds the same code as the sales sheet's
  `Master SKU` column (e.g. `FR-TNP-SB1`) for all three marketplaces —
  including Blinkit, where `SKU ID` is a different, Blinkit-internal
  numeric ID and is NOT used for matching. No fuzzy matching needed.
- **Per-marketplace ranking only** (confirmed) — a SKU's demand rank is
  computed against its own marketplace's sales rows only
  (`src/lib/demand/rank.ts`); Zepto POs are never compared against
  Blinkit's sales data. Duplicate (platform, Master SKU) rows in the
  sheet (56/144 combos on the sample data) are summed (GMV + Units) before
  ranking. Ranking metric is GMV only, continuous rank per marketplace
  (not a hard top-N cutoff).
- **Scoring** (`src/lib/demand/score-po.ts`, confirmed tiered bands) —
  rank 1–5: +25, 6–15: +15, 16–30: +10, 31–50: +5, beyond 50: +0. A
  multi-SKU PO sums the contribution of **every** SKU on it that has
  sales data (confirmed: "the more top-performing SKUs, the higher the
  score", not single-best-SKU-wins). A SKU with no match in the sales
  data contributes 0 (neutral) — combo/bundle packs fall back to this
  same neutral treatment for now. Discontinued SKUs are not filtered
  (confirmed: skip for now — the sheet has no active/discontinued
  signal).
- **City Workload bonus** (Priority Flow step 6, confirmed) — the single
  city with the most POs in the batch being ranked gets a flat +5;
  relative ranking, not tiered.
- **Tiebreak** (Priority Flow step 7) — equal-score POs sort by PO Value,
  then Pending Qty, then Marketplace (alphabetical; no order was
  specified beyond "marketplace tiebreak", so this is a default worth
  confirming if it ever matters in practice).
- **"Unscored" logic updated** — a PO is "Unscored" only when nothing
  fired at all: zero rules matched AND none of its SKUs have demand data.
  A PO with only a demand contribution (no rule matched) now correctly
  gets a real level via `levelForScore`, instead of falling back to
  "Unscored".
- **Explanation** — a compact "Demand contribution" table (SKU / Rank /
  GMV / Tier / Impact) in the PO detail panel, not prose sentences (the
  first version wrote a full sentence per matching SKU — "reads like a
  chatbot, not an analytics dashboard," fair feedback — replaced with the
  same table/badge language as everywhere else). A `"High-Demand SKU"`
  flag is added whenever any SKU on the PO ranks in the top
  `HIGH_DEMAND_RANK_THRESHOLD` (15) — gated there, not "any recorded
  sales data," because with a catalog as small as Zepto's (~57 SKUs)
  "rank ≤ 50" would flag nearly every PO and say nothing.
- **Top Performing SKUs section** (`src/components/dashboard/demand-
  intelligence.tsx`, `src/lib/demand/sku-table.ts`) — the dashboard
  section itself, per-marketplace (marketplace page) or tab-switched
  across Zepto/Blinkit/Instamart (Overview, since ranking is inherently
  per-marketplace — never one pooled list). KPI strip (Top 10 GMV Share,
  Top SKU GMV, Average GMV, Open POs containing a top-20 SKU), Top 10 /
  Top 20 / All(50) / In-Pending-POs-Only filters, a compact ranked table
  (Rank/SKU/Product/GMV/Units/Tier badge/Priority Impact/Pending-PO
  status), rows highlighted when the SKU sits in an open Pending PO, and
  a click-through side panel (Product Name, SKU, Marketplace Rank, GMV,
  Units Sold, Pending PO count, cities waiting, total pending qty,
  priority contribution). No emoji anywhere — tier badges (Very High/
  High/Medium/Low) use the same dot+label convention as Priority/Status
  badges elsewhere.
- **Validated against the real sheets** — spot-checked Zepto PO
  `P4915194` (5 SKUs, 4 matched: ranks #2/#4/#5/#11 → score 90 from
  demand + 10 metro bonus = 100, Critical) and independently
  cross-checked both Zepto's and Blinkit's full GMV rankings with a
  from-scratch script; both matched the engine's and the new table's
  output exactly.
- **Found while building this**: the root layout wraps the whole app in
  an `animate-fade-in-up` div (`src/app/layout.tsx`) — any CSS transform
  on an ancestor becomes the containing block for `position: fixed`
  descendants, so a slide-over panel opened after scrolling down a long
  page (like this new section makes marketplace pages) pinned to the
  *page's* scroll position instead of the viewport. Invisible on the
  shorter pages that existed before this section; fixed by rendering
  both slide-over panels through a `document.body` portal
  (`slide-over-portal.tsx`) so they always anchor to the real viewport.

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
pricing tab, plus `SALES_SHEET_URL` for the separate Demand Intelligence
sales workbook. `/settings` shows connection status read-only; nothing to
paste there today.

## Adding a marketplace (Flipkart Minutes)

Flipkart Minutes is registered as a 4th marketplace — same status
routing, same priority engine, same dashboard, same Demand Intelligence
scoring as Zepto/Blinkit/Instamart, with no marketplace-specific code
anywhere in the shared logic. It shows up in the sidebar, Overview,
marketplace filters, and Settings today, in a graceful "awaiting
configuration" state, the same way any marketplace missing its gid
already behaved.

What's generic and done:
- `MARKETPLACES` (`src/types/marketplace.ts`) and `SUPPORTED_MARKETPLACES`
  (`src/lib/sheets/marketplaces.ts`) both include it — everything that
  reads those two constants (sidebar nav, Overview KPIs/table, per-
  marketplace filters, Demand Intelligence tabs, Settings, the field
  catalog's marketplace enum) picked it up with no further code change.
- `TAB_CONFIG["Flipkart Minutes"]` reads its gid from
  `GOOGLE_SHEET_GID_FLIPKART_MINUTES` and — new, generic capability, not
  Flipkart-specific — optionally a **separate workbook** via
  `FLIPKART_MINUTES_SHEET_URL` (confirmed: don't assume every
  marketplace's data lives in the one shared sheet).
- A configurable **PO-Raised-Year floor** (`minPoRaisedYear`, set to 2026
  for Flipkart Minutes) filters on PO Raised Date, never Expiry Date, and
  logs + skips (never crashes on) any row with an unparseable date. This
  is a per-marketplace config value, not an `if (marketplace ===
  "Flipkart Minutes")` check, so any marketplace can opt into it.
- All statuses are already imported for every marketplace (confirmed
  pre-existing behavior, not new) — only `classifyStatus` routes
  `Pending` into the priority engine; anything else (including statuses
  this sheet hasn't shown before) falls into "Needs Review" rather than
  failing, so unknown Flipkart Minutes statuses are handled without code
  changes.
- Fixed two latent bugs this surfaced: `toLineItem`'s per-marketplace
  dispatch was an if/else-fallthrough that would have silently parsed a
  4th marketplace as if it were Instamart (now an exhaustive switch that
  throws for anything unmapped); and the sidebar/route slug was a bare
  `.toLowerCase()`, which breaks for a two-word name like "Flipkart
  Minutes" (now a proper `marketplaceSlug()` helper — its URL is
  `/marketplaces/flipkart-minutes`).
- `fetchAllPurchaseOrders` (used by Overview) now fetches every
  marketplace independently (`Promise.allSettled`, not `Promise.all`) —
  one unconfigured marketplace no longer takes the whole Overview page
  down for the ones that do work.

What's still open — **needs the real sheet, not guessed**, same as every
other tab/workbook connected in this project:
- Column layout (`poNoColumn`, `poLevelColumns`, `headerRowIndex` in
  `TAB_CONFIG`) and its own `toLineItem` case — PO Number/City-or-FC/SKU/
  date column names, whether it tracks Dispatched Qty separately, header
  row offset. `fetchPurchaseOrders("Flipkart Minutes")` throws a clear
  "not yet mapped" error rather than guessing (visible today as the
  Awaiting Config message on its marketplace page).
- A city-derivation function for its FC-name or location format (see
  `src/lib/po/city.ts`'s three existing per-marketplace parsers).
- Confirming its brand color (currently reusing Flipkart's own blue,
  `#2874F0`/`#4FA3FF`, as a placeholder).

Also flagged, not yet built (bigger, and applies to **all** marketplaces
once scoped, not a Flipkart-specific ask): Top Cities / Top FCs / Top
SKUs dashboard widgets, a Year/Status/Expiry-Window/Top-SKU filter set,
and a dedicated Reports section — none of these exist for Zepto/Blinkit/
Instamart today either, so building them once the sheet is connected (and
real data can validate them) is a separate, explicitly scoped follow-up
rather than something silently dropped.

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
