# 005 — Supplier detail page, geo layer, MCP server

## Context
- Dataset has 18 score dimensions but no geo/contact columns. All 10k
  supplier IDs are anonymized (`SUPP_`), researched rows are `RSCH_`.
- shadcn-map = Leaflet + React Leaflet + MapLibre/OpenFreeMap vector tiles.
  No API key needed. Install: `bunx shadcn@latest add @shadcn-map/map`.
- Open-Meteo archive API is keyless: monthly temp/precip normals per coords.
- Python agent currently emits 18 scores; extend `schema.py`/`app.py` so a
  research run also extracts `hq_location` (city, country, lat, lon),
  `website`, `contact_email/phone`, `hazard_notes`. Stored in reasoning JSONL
  + CSV; `lib/supplier-data.ts` union picks it up.

## A. Geo assignment for synthetic suppliers
- `lib/geo.ts`: curated list ~30 industrial regions {name, country, lat, lon,
  hazards: {earthquake, flood, tsunami, cyclone} 0-3 levels, seasonMonths}.
  Deterministic hash of supplier id → region (weighted toward DE/CN/US).
- Hazard data is a small static table — no fragile live API.

## B. Supplier detail page `/supplier/[id]`
- Server component, loads via `getSupplierById`.
- Sections: header (name, RiskBadge, level chips), contact card
  (researched: real HQ/site/phone; synthetic: "internal record" + Research-CTA),
  map block, grouped collapsible dimensions (all 18, grouped: Financial /
  Operational / Compliance & ESG / Geo & Political / Market & Quality),
  compare CTA.
- Map: `Map` + `MapMarker` + `MapCircle` hazard overlays (radius ~ level,
  color per hazard type), zoom control, fullscreen control.
- Below map: monthly strip — 12 bars from Open-Meteo (avg temp, server
  route `/api/climate?lat&lon` with cache), hazard-season months tinted,
  hover tooltip "Typhoon peak season" etc.

## C. Collapsible dimension groups in right-side profile panel
- Reuse same grouped component on the detail page AND in `supplier-detail`
  panel (accordion, risk-bar rows, default-open group = highest risk).

## D. Concentration risk in compare
- `lib/concentration.ts`: over selected suppliers → cluster by region/hazard
  zone/sourcing level. If >40% share one hazard zone or sourcing risk ≥ high,
  warning callout in `ComparisonDialog` + `/compare` page
  ("7 of 12 suppliers sit in the Pacific typhoon belt").
- Optional mini-map in compare dialog with markers for all selected.

## E. MCP server `/api/mcp`
- `mcp-handler` package, single route. Tools (zod schemas, reuse existing):
  `search_suppliers(query, level?)`, `get_supplier(id)`,
  `compare_suppliers(ids[])` (≤20), `portfolio_stats()`,
  `research_supplier(name)` (spawns agent, note: minutes).
- Verify with `npx @modelcontextprotocol/inspector`.

## F. Redis cache
- `lib/cache.ts`: ioredis client (REDIS_URL env), graceful in-memory
  fallback when Redis is absent — dev works without it.
- Cache: `/api/climate` results (24h), `/api/resolve` (24h), supplier
  list/query results (short TTL), geocode lookups.
- Map tiles: `/api/tiles/[z]/[x]/[y]` proxy → OpenFreeMap pbf, cached in
  Redis (7d); style JSON fetched server-side and rewritten to proxy URL.

## G. Kill number animation in dialogs/detail/compare
- `AnimatedNumber` gets `animate?: boolean` (default true). With false it
  renders the formatted plain span — same path as the offscreen fallback.
- Pass `animate={false}` in: SupplierDetailPanel, ComparisonDialog,
  ComparisonTable, /compare page. Keep animation on metric cards/badges.

## Steps
1. [x] `lib/geo.ts` regions+hazards, wire into `Supplier` type (lat/lon/region).
2. [x] `lib/cache.ts` + `/api/climate` route (Open-Meteo monthly aggregate).
3. [x] `/api/map-proxy/[...path]` proxy + rewritten style JSON; shadcn-map install.
4. [x] Detail page `/supplier/[id]`: contacts, map, hazard circles, month strip.
5. [x] Grouped collapsible dimensions component; use in page + side panel.
6. [x] Compare concentration callouts (dialog + /compare).
7. [x] Extend agent schema for contacts/HQ; map in research route.
8. [x] `animate={false}` in dialogs/detail/compare.
9. [x] MCP server route `/api/mcp` — verified via JSON-RPC initialize + tools/call.
10. [x] Verify: tsc/oxlint/eslint clean, browser walkthrough done.

## Notes
- All 18 score dimensions now loaded (was 8); schema + DuckDB query extended.
- Research CSV contact columns are optional — header inspected per read,
  missing columns degrade to NULL (backwards-compatible with old CSVs).
- Vendored registry files (map.tsx etc.) excluded from anti-slop oxlint.
- Redis via REDIS_URL; absent → in-memory fallback, dev unaffected.

## Risks
- shadcn-map compat with Next 16/React 19 — fallback: maplibre-gl or
  react-leaflet directly.
- Open-Meteo latency → server-side cache + loading skeleton.
- Scope is large; order above = value-first, each step ships independently.
