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
  chain and appears in the ranked Control Tower table. "Expired",
  "Dispatched", "Delivered", "Cancelled", and "Needs Review" (any other
  status — Price issue, Scheduled, Revised appt. required) each get
  their own read-only tab instead of being scored alongside Pending or
  hidden outright — historical POs stay visible for dispatch-
  performance/analytics rather than silently disappearing. Cancelled
  used to be fully hidden (silently dropped) but now gets its own
  visible tab too (confirmed) — only RTO Done/"Low Value Cant Dispatch"
  are excluded everywhere (`isFullyExcludedStatus`, deliberately
  narrower than the older `isTerminalStatus` — the latter is still used,
  unchanged, by `computeTimeline`/Operational Delay math, where
  Delivered/Cancelled/Closed/Completed also count as "done"). "Needs
  Review" is real unclassified ground, not a guess — see below.

**Bug found and fixed (not status-parsing, a priority-engine gap):**
`computePoPriority` (`src/lib/rules/priority.ts`) used to score *every*
PO handed to it, with no status check at all. Callers already restrict
the ranked Control Tower table to Pending POs, but the Expired/
Dispatched/Delivered/Needs Review secondary sections build their
`PoRow`s the same way (`buildPoRows`) so the rule engine could match on
unrelated criteria (PO Value, city, qty, ...) — and every row, in every
section, opens the same `PoDetailPanel` that renders `PriorityBadge` +
Score unconditionally. Net effect: a Delivered (or Cancelled/Closed/
Dispatched) PO's own Status was read correctly, but clicking into it
could still show a real, sometimes "Critical," priority score. Fixed by
gating `computePoPriority` itself on `isPendingStatus` (returns
score 0 / level "Unscored" for anything else) — the single shared entry
point, not just the table columns that happen not to render score/level
today — plus a second gate in `buildPoRows`'s City Workload bonus, which
could otherwise re-introduce a non-zero score/level on its own for a
non-Pending PO sitting in its batch's top city. Verified with a
synthetic test: a Delivered/Cancelled/Closed/Dispatched PO with a huge
PO Value, an already-past expiry date, and a rule that plainly matches
on PO Value now scores 0/Unscored in every path (direct
`computePoPriority` call and via `buildPoRows`), while a Pending PO in
the same batch still scores normally — confirmed live too, clicking a
real Delivered/Dispatched PO's detail panel on the actual Zepto data now
shows "Unscored · Score 0" instead of a computed level.

**Status parsing hardened at the same time** (`src/lib/sheets/
marketplaces.ts`): a `normalizeStatus` step now runs after the
first-non-blank field resolution described below — case-insensitive,
trimmed matching against the confirmed vocabulary (Pending, Delivered,
Dispatched, Cancelled, Closed, Completed, Scheduled), any other non-blank
text preserved as-is rather than discarded, and a genuinely
blank/undeterminable status (every row in a PO's group had an empty
Status cell) becomes `"Unknown"` with a logged warning — never silently
defaulted to Pending. Audited the whole parser for a Pending fallback:
there wasn't one (`row["Status"] ?? ""` only guards a missing column,
never guesses a value), but this makes "never default to Pending"
explicit and enforced rather than merely true by omission. A temporary
(intended to stay on) debug log for Flipkart Minutes prints, per PO:
raw Status straight off the sheet, the normalized/parsed Status, whether
the priority engine considers it eligible (mirrors
`computePoPriority`'s own `isPendingStatus` gate exactly, so it's a true
preview, not a separate guess), and why — plus a one-line validation
summary of how many POs got a parsed PO Issue Date / Expiry Date.

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
  views, column pinning, expandable rows. CSV export was added later
  (see below). Flag if you want the rest built next.

## Density pass (enterprise grid layout)

Rebuilt the Control Tower table around a hard column-width budget
(`COL` in `po-control-tower.tsx`) via `<colgroup>` + `table-layout:
fixed`, instead of letting content push columns wider — verified at
1920×1080 with **zero horizontal scroll** (table's scrollWidth ==
clientWidth). Sticky columns: rank, Priority, PO Number, Marketplace
(cumulative `left` offsets computed from the column widths, not
guessed). Long text (FC/warehouse name, the Reason/Action column)
truncates with `title=` for the full value on hover. Row height/font at
the time dropped to ~12px text with ~4-6px padding (superseded twice
since — see "Row height / density pass" and "Enterprise redesign v2"
below for the current fixed 40px row height).

The old big "Expiring Soon / Metro Queue / Low Value Orders" section
cards are gone — replaced with compact toggle chips in the filter
toolbar (each shows a live count, click to filter the table itself, no
separate list to maintain). Expired POs / Needs Review / charts are
tucked behind a collapsed `<details>` disclosure below the main table,
so by default the KPI strip + filters + table take up the page, per the
requested "KPI strip → filters → full-width table" hierarchy.

KPI cards shrunk ~55% (126px→118px wide, single line of text, hover
tooltip on the label — since redesigned again, see "Enterprise redesign
v2" below) and the sidebar narrowed (240px→176px expanded, 64px→48px
collapsed) to give the table more room.

**Not built in this pass** (genuine new functionality, not layout):
Excel-style column resize-by-drag, keyboard grid navigation
(arrow-key cell movement), column pinning beyond the fixed sticky set.
Sorting, filtering, and click-to-drill-in already work. (CSV export was
added in a later pass — see "Excel/CSV export" below.)

## Excel/CSV export

Every dashboard table (Control Tower ranked table, Expired/Dispatched/
Delivered/Needs Review secondary tables, Top Performing SKUs) has an
Export button (`src/components/dashboard/export-button.tsx`,
`src/lib/export/csv.ts`) that downloads the currently-filtered rows as a
`.csv` file — no new dependency; hand-rolled CSV generation (proper
quote/comma/newline escaping) with a UTF-8 BOM prefix so Excel renders
`₹` and other non-ASCII characters correctly instead of mangling them.
Disabled when there are zero rows to export. Exported values are raw
(numbers, ISO dates) rather than the display-formatted strings shown in
the table, so the file is usable for further spreadsheet work, not just
a visual copy.

## Row height / density pass (fixed-height rows)

The ranked table's rows were briefly inconsistent height (a row with a
long Reason/Action wrapped and grew taller than its neighbors, with
large visual gaps between rows as a result). Fixed by going back to a
hard fixed row height (56px at the time, since reduced to 40px — see
"Enterprise redesign v2" below) with `flex h-full items-center` wrappers
for vertically centering badge cells, and switching long text back to
single-line `truncate` + `title=` tooltip instead of wrapping. The
Reason/Action column now shows only the single highest-priority reason
plus a "+N more" badge when there are others, instead of joining every
triggered rule into one long wrapped string — hover/the row's `title`
reveals the rest. This same row height and truncation convention is
shared by every marketplace's table and the secondary tables, so
Zepto/Blinkit/Instamart/Flipkart Minutes all look identical. The gap
between the KPI strip and the table was also tightened
(`space-y-2` → `space-y-1.5`) so it reads as one connected dashboard.

## Enterprise redesign v2 (Power BI / SAP Fiori / NetSuite reference)

A full visual pass across the whole app, using a screenshot of an
internal Frido Demand Planning dashboard (Power BI-style: dense, flat,
white background, big bold KPI numbers) as the design philosophy
reference — not copied directly, but matched in spirit: clean,
enterprise, dense, minimal scrolling, built for an ops team using it 8+
hours a day. Concrete changes:

- **Colors** — primary brand accent is now `#FFC700` ("Frido Yellow",
  was `#FFD400`); page background is pure white (was `#F8F9FA`); Amazon's
  marketplace color is now a deliberate dark navy blue (`#1B3A5C`) rather
  than Amazon's own real-world orange/black branding — a design-system
  choice for this dashboard's marketplace color set, confirmed distinct
  from every other marketplace's hue. Every other marketplace color was
  already correct (Zepto purple, Blinkit yellow, Instamart orange,
  Flipkart Minutes blue, Myntra pink).
- **No glassmorphism** — `.glass-card` (used by every card/table
  container in the app) dropped `backdrop-blur`/translucency and is now a
  flat solid white card with a 1px light-grey border; the `card-elevate`
  hover-lift-with-shadow utility was removed outright (only one caller,
  a bar chart). Border radius tokens shrank across the board (18px card
  token → 8px; `rounded-xl`/`rounded-2xl`/`rounded-3xl` one-offs on
  panels/callouts → `rounded-md`); slide-over detail panels lost their
  `shadow-2xl` (→ `shadow-lg`) and backdrop blur on the overlay.
- **KpiCard rewritten** (`src/components/dashboard/kpi-card.tsx`) — no
  icon (confirmed brief: "Number / Small label / Tiny trend... nothing
  else"); a big bold 28px tabular number is now the dominant element,
  with a tiny uppercase muted label above it, and criticality shown as a
  3px colored left border instead of an icon badge. Every `KpiCard`
  caller (`page.tsx`, marketplace `page.tsx`, `demand-intelligence.tsx`)
  had its `icon={...}` prop and now-unused lucide-react import removed.
- **Badges are rectangles, not pills** — `PriorityBadge`, `StatusBadge`,
  and `MarketplaceBadge`'s full-size variants (the compact table variants
  were already rectangular) switched `rounded-full` → `rounded`; every
  toggle/chip button across the app (quick-filter chips, Top-10/20/All
  range toggles, marketplace tabs, flag/tag chips in detail panels) got
  the same treatment, so nothing in the UI is pill-shaped anymore except
  literal status dots (which are meant to read as dots).
- **Row height 56px → 40px** (`ROW_HEIGHT` in `po-control-tower.tsx`,
  same fixed-height/truncate approach as before, now denser) — 22 rows
  visible without scrolling at 1920×1080 on the Overview page (was
  fewer at 56px), within the requested 20-30-rows-on-screen target. The
  same 40px row height was applied to `secondary-po-table.tsx` and
  `demand-intelligence.tsx`'s table for consistency. Table header font
  10px → 11px; sticky header background switched from translucent+blur
  to solid (no longer needed once cards stopped being translucent).
- **New Expiry filter** — a single-select dropdown (Overdue / Due Today /
  ≤3 Days / ≤7 Days / 8+ Days) added to the Control Tower's toolbar,
  alongside Marketplace/City/Priority/Search — distinct from the existing
  OR-able "Overdue"/"Expiring ≤3d" quick-filter chips (dropdown picks
  exactly one bucket; chips layer on top of everything else).
- **Sidebar and slide-over polish** — collapse button and theme-toggle
  buttons went from `rounded-xl` to `rounded-md`/`rounded`; removed the
  root layout's page-navigation fade-in wrapper (`animate-fade-in-up` on
  every route change was friction, not decoration, for a tool used all
  day) while keeping the same animation on slide-over detail panels
  (a legitimate entrance affordance for a panel that pops in, not a
  full-page transition). `SlideOverPortal`'s comment was updated to stop
  referencing the now-removed wrapper as its reason for existing — it's
  kept as a general defense against any future ancestor transform, not
  a workaround for one specific div anymore.
- **Verified** via Playwright at 1920×1080 and 1366×768: row height
  exactly 40px in both, zero page-level horizontal scroll, dark mode
  renders correctly (flat dark cards, colored left-border accents still
  visible), row click still opens the detail panel, filters/export still
  work, real Zepto/Blinkit/Instamart data renders with no regressions.

## Sticky status tab bar (marketplace pages)

Replaced the collapsed `<details>` block ("Expired, Dispatched,
Delivered, Needs Review, and Charts" — you had to click it open, then
scroll, to see anything but Pending) with a sticky tab bar directly
below the KPI strip: Pending / Critical / Delivered / Dispatched /
Cancelled / Expired / Needs Review, each with a live count, one click to
switch, no page reload. Scoped to the marketplace pages only
(`/marketplaces/[marketplace]`) — Overview wasn't asked for and pools
all four marketplaces together, a different enough shape that tabbing
it wasn't in scope here.

- **New component** `MarketplaceTabbedView`
  (`src/components/dashboard/marketplace-tabbed-view.tsx`, client-side)
  owns which tab is active — entirely separate state from each table's
  own City/Search/Priority filters, so changing a filter never resets
  the selected tab, and switching tabs is instant (client-side
  `useState`, not a route change).
- **"Critical" is a shortcut, not a real status** — it shows the exact
  same Pending rows in the same ranked `PoControlTower`, just with the
  Priority filter pre-set to Critical (`initialLevelFilter` prop, new).
  The dropdown stays fully usable afterward; this only decides where it
  starts.
- **Cancelled is a new, real, visible bucket** (confirmed) — previously
  Cancel/Cancelled sat in `isFullyExcludedStatus` and were silently
  dropped everywhere, same as RTO Done. Now only RTO Done stays fully
  hidden (`isCancelledStatus`, new; `StatusBucket` gained a `"cancelled"`
  member). No priority scoring or Operational Delay applies to it
  (`isTerminalStatus` already covered "cancel"/"cancelled" before this
  change, so that part needed no update) — it's read-only history, same
  as Delivered/Dispatched.
- **Every non-Pending tab gained City + Search filters**
  (`SecondaryPoTable` now has its own small toolbar, matching the
  ranked table's style) — previously these read-only tables had no
  filtering at all. Priority is deliberately absent there — nothing on
  those tabs is priority-scored, so a Priority filter would have nothing
  real to filter by.
- Switching between tabs remounts whichever table is showing (`key=
  {activeTab}`) rather than trying to preserve one table's filter state
  across a totally different bucket of POs — a clean slate per tab,
  which is how tab metaphors normally work elsewhere (browser tabs,
  spreadsheet sheet tabs, etc.).
- Sticky via plain CSS `sticky top-0` — no scroll-container gymnastics
  needed since the page scrolls in the normal document flow; confirmed
  it stays pinned to the viewport top on scroll via Playwright (bounding
  box `top: 0` after scrolling 400px down).
- Verified against real Zepto/Blinkit/Instamart/Flipkart Minutes data:
  all 7 tabs render with correct live counts, clicking each one filters
  the table instantly with no reload, the Critical shortcut correctly
  shows only Critical-level rows, Cancelled POs are now visible (17 on
  Zepto, previously invisible), and dark mode renders correctly.

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

**Column mapping confirmed** (2026-07) — `TAB_CONFIG["Flipkart Minutes"]`
in `src/lib/sheets/marketplaces.ts`:

| Our field | Sheet column |
|---|---|
| Status | `Status` |
| PO Number | `PO number` |
| PO Raised Date | `PO IssueDate` |
| Expiry Date | `Expiry Date` |
| Appointment Date | `Scheduled Date` |
| City | `City` (read directly — no derivation, unlike Zepto/Blinkit/Instamart) |
| Warehouse/FC | `Location` |
| SKU | `FSN` |
| Ordered Qty | `Total PO Qty` |

Not modeled on the shared `PurchaseOrder` type (no other marketplace has
these): `Frido Dispatch WH` is captured on each line item and carried
through in `raw.lineItems` but not surfaced in the UI yet; there's no
Dispatch Date or Dispatched Qty column, so those stay `null`/`0` (Avg
Dispatch Time simply won't count Flipkart Minutes POs, the same way it
already skips any PO without a Dispatch Date); there's no separate SKU
description column, so `skuDescription` is empty.

The sheet has a merged "Flipkart Minutes" title row above the real
header at no fixed offset, so its header row is **auto-detected**
(`autoDetectHeader: true` + `requiredColumns`) rather than a hardcoded
row index — scans the first 20 rows for whichever one contains every
required column name, and throws a clear "required column X not found"
error (naming the column) if the sheet is missing one it needs, rather
than silently parsing the wrong row as the header. `fetchPurchaseOrders`
also logs a one-line summary on every fetch (any marketplace, not just
this one): total POs parsed, product rows parsed, and Pending/Delivered/
Cancelled counts — a standing sanity check, not a one-off.

**Two bugs found and fixed while wiring this up**, both in how
multi-line POs get their shared PO-level fields (Status, dates, City,
Location):

1. (pre-existing, not specific to Flipkart Minutes) The original
   `forwardFillPoLevelColumns` decided "is this cell blank, so reuse the
   last value" independently *per column*. That's wrong for any column
   that can be legitimately blank on a real, new PO (e.g. no Scheduled
   Date yet) — a brand-new PO's row would silently inherit an unrelated
   *previous* PO's value for that column instead of staying blank. A
   synthetic test (a mocked sheet fed through the real
   `fetchPurchaseOrders` pipeline, since there's no test framework in
   this project yet) caught it: a Cancelled PO with no Scheduled Date
   came back with the *previous* PO's Scheduled Date instead of null.
   First fix: decide "is this row a continuation" once, off `PO Number`
   alone, instead of column-by-column.
2. That first fix still assumed the row carrying a merged cell's real
   value is always the group's *first* row, forward-filling it onto the
   rows that follow. True for Zepto/Blinkit/Instamart's real sheets, but
   not guaranteed in general — a second synthetic test modeled Flipkart
   Minutes' actual shape (PO Number repeated on every row of a block,
   but Status/dates only genuinely populated on one row in the *middle*
   of it) and confirmed forward-fill alone can never backfill the rows
   *before* that anchor row. Real fix: `forwardFillPoNumber` (renamed
   from `forwardFillPoLevelColumns`) now forward-fills only the PO
   Number grouping key; `aggregateLineItems` resolves every other
   PO-level field (`firstNonBlank` helper in
   `src/lib/sheets/marketplaces.ts`) by scanning the *whole* line-item
   group for the first non-blank value, which is correct regardless of
   which row happens to carry the real data.

Re-verified against the real Zepto/Blinkit/Instamart sheets after both
fixes — identical scores/ranks/parsed counts to before, as expected
(these sheets' real data always anchors PO-level fields on the group's
first row, so `firstNonBlank` picks the same value `group[0]` always
did). Also re-confirmed against a synthetic mid-block-anchor scenario:
Status/City/Location/dates all resolve correctly no matter where in the
block the real values sit.

**Third bug, found from a real Flipkart Minutes screenshot** (PO
`FBPWN07536855`: sheet said Delivered, dashboard showed Pending +
Expired + 141 days late): this was never a Status *parsing* bug — the
priority engine ran on every PO regardless of status (see "Priority
Engine Rules" below); the actual parsing logic already handled this
exact shape correctly. While rebuilding the grouping logic to match an
explicit "PO-by-PO, anchor row + inherit, never overwrite" mental model
(clearer to reason about than the previous scan-based description, even
though behaviorally almost identical for well-formed data), a real
regression surfaced against the live Zepto sheet: switching to
strictly-contiguous PO blocks (a row starts a new PO, rows after it
belong to that PO until a different PO Number appears) silently split
one real PO into two whenever the same PO Number legitimately
reappeared non-contiguously in the sheet (e.g. a SKU added to an
existing PO further down the file) — Zepto's parsed count moved from
374 to 375 POs. Fixed by keeping PO-Number-keyed grouping (a `Map`, not
row-adjacency) so every row sharing a PO Number merges into one PO no
matter where it sits in the file, while still resolving each PO-level
field via `firstNonBlank` (first non-blank value found across the whole
group, in row order) rather than trusting the group's first row
specifically. A synthetic test now covers this exact case (a PO's rows
split by an unrelated PO in between) as a permanent regression guard.

Also added while investigating: an expanded status vocabulary
(`Dispatch Scheduled`, `Rejected`, alongside the existing Pending/
Delivered/Dispatched/Cancelled/Closed/Completed/Scheduled), a business
rule that Delivered/Dispatched POs are fully out the door regardless of
what the sheet's own dispatched-qty tracking says (`Dispatched Qty =
Ordered Qty`, `Pending Qty = 0` — several sheets don't track dispatched
quantity at all, so without this a Delivered PO would still show 100%
pending), and a generic (every marketplace, not just Flipkart Minutes)
validation pass that runs on every import and logs a distinct
`[VALIDATION FAIL]` error the moment a PO's resolved Status/quantities
disagree with what its own sheet row says — the exact check that would
have caught this bug the moment it happened, rather than relying on
someone noticing it in the UI. The Flipkart Minutes debug log now also
prints `Inherited From Parent: Yes/No` per PO (whether the value had to
be found on a row other than the group's first).

Still open: confirming Flipkart Minutes' own brand color (currently
reusing Flipkart's own blue, `#2874F0`/`#4FA3FF`, as a placeholder), and
setting `GOOGLE_SHEET_GID_FLIPKART_MINUTES` (plus `FLIPKART_MINUTES_
SHEET_URL` if it's a separate workbook) wherever this runs.

Also flagged, not yet built (bigger, and applies to **all** marketplaces
once scoped, not a Flipkart-specific ask): Top Cities / Top FCs / Top
SKUs dashboard widgets, a Year/Status/Expiry-Window/Top-SKU filter set,
and a dedicated Reports section — none of these exist for Zepto/Blinkit/
Instamart today either, so building them once real data can validate
them is a separate, explicitly scoped follow-up rather than something
silently dropped.

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
