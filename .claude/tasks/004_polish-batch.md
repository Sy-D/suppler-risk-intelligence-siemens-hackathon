# 004 — Polish-Batch (10 Punkte) — ALLE ERLEDIGT

## Header
- [x] "CSV snapshot"-Badge + CircleHelp-Button entfernt; `CircleHelp`-Import
      gelöscht (`FileText` bleibt für Memo-Button).

## Sidebar
- [x] Icon-Clipping gefixt: `group-data-[collapsible=icon]:p-0` +
      `justify-center` im Header (vorher p-2 → 36px-Icon in 48px-Rail ragte über).

## Hero
- [x] Eyebrow/H1/Subtitle entfernt; "Ask your analyst"-Button bleibt
      (`justify-end`).

## MetricCards (4 Facts)
- [x] `BorderBeam size="pulse-inner"` pro Card (läuft NICHT den Rahmen
      entlang), eigene `colorVariant`: ocean / forest / candy / gold.
      `strength` 0.45 → 1.0 auf Hover via `useState` + Pointer-Handler.

## RiskLandscape
- [x] Crosshair: gestrichelte V/H-Linien zum X/Y-Rand + Werte-Labels
      (risk unten mittig, delivery links vom Punkt). `hovered` in draw-deps.
- [x] Klick auf aktiven Punkt deselektiert: `onSelect` toggelt in
      supplier-dashboard (`current?.id === supplier.id ? null : supplier`).

## Tabelle
- [x] Header-Checkbox selektiert/deselectiert alle `visible` Rows der Page
      (Base UI `indeterminate` bei Teilauswahl, 20er-Cap via `next.size >= 20`).
- [x] "Deselect all"-Ghost-Button in Filterzeile wenn `selected.length > 0`
      (zusätzlich zum "Clear" in der Sticky-Bar).

## Sticky Compare-Bar
- [x] Aus `SidebarInset`-Ebene in die linke Grid-Spalte
      (`min-w-0 space-y-6`, nach der Tabellen-Card) verschoben → nur noch
      Tabellenbreite.

## ChatDock
- [x] Beam-Radius gefixt: `borderRadius={999}` (Input ist `rounded-4xl`-Pille;
      vorher 10 → eckiger Beam über rundem Input).
- [x] Fullscreen-Button (Maximize2/Minimize2) neben X; `full`-State schaltet
      `inset-4 max-w-4xl` + flex-1 Scroll-Area.

## Compare-Dialog
- [x] `ComparisonTable` aus Dialog extrahiert (export, workspace-panels.tsx).
      "Full view"-Button im Dialog-Header → `/compare?ids=…`.
- [x] `app/compare/page.tsx`: Server Component, `searchParams` await,
      `getSuppliers()` + Filter, Back-Link, leere Liste → Hinweis.
      Buttons mit `render={<Link>}` brauchen `nativeButton={false}` (Base UI).

## Nachtrag: Card-Glow + Marquee
- [x] Cards: `pulse-inner`-Beam durch eigenen Aurora-Layer ersetzt —
      radialer Blob (`size-56 blur-2xl`, per `auroraColors`-Map pro Card
      gefärbt, `satisfies` statt Record-Annotation wg. anti-slop), clippt auf
      Card-Radius, Hover schiebt ihn näher ran + Opacity 0.45→1.
      `animate-aurora` Keyframes (6s alternate drift) in globals.css.
- [x] Chart-Marquee: PointerDown/Move/Up auf dem Canvas; <6px = Klick
      (Dot-Toggle bleibt), >=6px = Gummiband-Div + `onSelectArea(ids)` →
      `selectArea()` merged ins Set mit 20er-Cap + Notice.
      `setPointerCapture` in try/catch (synthetische Pointer werfen).
      `draggedRef` unterdrückt den Click-Handler nach einem Drag.
- [x] Sidebar: "Suppliers"-Item (mit 10,000-Badge) entfernt — kein eigener
      Page-Link.

## Verifikation
- tsc --noEmit, oxlint, eslint: sauber.
- Browser: Beams auf Cards sichtbar (4 Farben), Crosshair rendern,
  Select-all (8 Rows), Dock-Fullscreen-Buttons, /compare rendert Tabelle,
  Marquee selektiert Punkte (Notice + Rows markiert, Cap greift).
- Bekannte lib-interne Dev-Warnings von border-beam (style-Tag-Injection,
  Deps-Array) — kosmetisch.
