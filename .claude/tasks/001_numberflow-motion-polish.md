# 001 — NumberFlow & Motion Polish

Ziel: Werte fühlen sich "lebendig" an (sichtbares Count-up/Rolling), Chart bekommt
eine echte Entrance-Animation, Tabellenzeilen sind komplett klickbar, Sidebar-Card
"Dataset connected" wird entfernt.

## Schritte

- [x] `globals.css`: Keyframes `detail-in` (opacity + translateY 5px, 240 ms
      quint-out) und `row-in` (opacity-only, 220 ms, `both` fill für Stagger-Delays)
      + Tokens `--animate-detail-in` / `--animate-row-in` in `@theme`.
- [x] `supplier-dashboard.tsx`:
  - MetricCard: `spinTiming` 720 ms expo-out (`cubic-bezier(0.19,1,0.22,1)`),
    `transformTiming` 480 ms → sichtbares Rolling beim Mount und bei Änderungen.
  - `AnimatedNumber` zusätzlich in: Sidebar-Badges (Suppliers-Count,
    Compare-Count), Chart-Statuszeile ("x shown"), Chart-Badge ("x selected"),
    Tabellen-Titel-Badge (filtered count), Footer-Range + Page X of Y,
    Sticky-Bar ("x of 20 selected").
  - Tabellenzeile: `onClick` toggelt Auswahl, `cursor-pointer`,
    `aria-selected`, `motion-safe:animate-row-in` mit 24 ms Stagger pro Zeile;
    Checkbox-Wrapper und Profil-Button stoppen Propagation (getestet:
    kein Doppel-Toggle).
  - Sidebar-Footer: "Dataset connected"-Card + `ShieldCheck`-Import entfernt.
- [x] `risk-landscape.tsx`: ganze-Canvas-Fade ersetzt durch rAF-Entrance —
      jeder Dot eased (easeOutCubic) in Alpha + Radius (0.35→1), Stagger als
      Links→Rechts-Sweep entlang der Risiko-Achse (30 % der Timeline),
      Duration 550–850 ms je nach Datenmenge; Active-Ring fadet mit;
      `prefers-reduced-motion` → sofort final; ResizeObserver zeichnet mit
      `progressRef` neu.
- [x] `supplier-detail.tsx`: Content in `<div key={supplier.id}>` mit
      `motion-safe:animate-detail-in` → Wechsel zwischen Suppliern crossfadet
      dezent statt hart zu springen.
- [x] `workspace-panels.tsx`: ComparisonDialog — Spalten-Stagger
      (45 ms/Supplier) auf Header + allen Wert-Zellen; Supplier-Anzahl in
      DialogDescription per `AnimatedNumber`.
- [x] Verify: `tsc --noEmit` ✓, `oxlint` ✓ (0 errors), `eslint` ✓,
      Browser-Check ✓ (16 laufende Animationen beim Reload, Row-Click toggelt,
      Checkbox-StopPropagation ok, Chart-Dots gerendert, Karte weg).

## Out of scope (bewusst)
- Keine neuen Dependencies (kein Framer Motion — WAAPI + CSS reichen hier).
- Sticky Bottom-Bar bleibt wie sie ist.
