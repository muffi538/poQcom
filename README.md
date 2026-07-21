# AI Operations Control Tower — framework (v0)

Purchase Order priority dashboard for Zepto / Blinkit / Instamart / BigBasket,
built on top of Google Sheets. This commit is **scaffolding only** — no
scoring, thresholds, or business rules are implemented. See "Open questions"
in the PR/issue thread; nothing past this point gets built until those are
answered.

## What exists

- Next.js + TypeScript + Tailwind app shell with pages for Overview,
  per-marketplace dashboards, Rules Builder, Simulator, and Settings.
- `src/types/rules.ts` — generic rule schema (conditions, nested AND/OR
  groups, accumulate/override actions, stop/continue). No business logic,
  just the shape a rule takes.
- `src/lib/rules/engine.ts` — a mechanical rule evaluator: walks a condition
  tree and applies whatever actions the rule data specifies. It invents no
  scores or thresholds of its own.
- `src/lib/rules/storage.ts` — placeholder JSON-file persistence for rules,
  groups, and history. Swap for a real database once one is chosen.
- `src/lib/sheets/` — Google Sheets connector (service-account auth, reads a
  configured range into normalized `PurchaseOrder` rows).

## Where the Google Sheet link goes

Two supported spots, same value either way:

1. **`.env`** (copy from `.env.example`) — `GOOGLE_SHEET_URL` or
   `GOOGLE_SHEET_ID`, plus the range(s) and service-account credentials.
   This is what the app reads today.
2. **Settings page** (`/settings`) — currently read-only, shows connection
   status and walks through the same `.env` steps. Whether ops users should
   be able to paste the link directly into this UI (instead of an env var)
   is one of the open questions, since that needs a small settings store.

Either way: share the sheet with the service account's email as **Viewer**.

## What's deliberately not built yet

- Any scoring, weighting, or priority calculation.
- The interactive drag-and-drop rule editor (the page exists, but Create/
  Import/Export etc. are disabled) — it needs the confirmed field catalog
  (real sheet column names) first.
- SLA % / days-remaining calculation — needs the sheet's actual date
  columns and processing-window definition.
- AI Suggestions, City/Warehouse/Marketplace analysis, SKU Risk.

## Running it

```
npm install
cp .env.example .env   # then fill in the sheet + service account details
npm run dev
```
