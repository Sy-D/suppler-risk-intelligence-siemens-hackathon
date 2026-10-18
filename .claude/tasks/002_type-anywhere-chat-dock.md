# 002 — Type-anywhere Overlay + Chat-Dock

Branch: `feat/type-anywhere-chat`

## UX-Flow (umgesetzt)
1. Druckbares Zeichen irgendwo (kein Input, kein Modifier) → Quick-Search-Overlay
   (zentriert bei 18 svh, Backdrop-Blur), Zeichen landet im Input. Cmd/Ctrl+K
   öffnet leer.
2. Live-Trefferliste: max. 7 Supplier (Name, ID, RiskBadge, Delivery via
   NumberFlow), ArrowUp/Down + Hover-Auswahl, Enter/Klick → Supplier-Profil.
   Letzte Zeile "Ask your analyst: <query>" — Enter dort (oder Cmd+Enter
   überall, oder Enter bei 0 Treffern) → Dock.
3. Overlay schließt, `ChatDock` slidet von unten hoch (`dock-in`,
   340 ms iOS-Sheet-Kurve) und beantwortet die mitgegebene Query sofort als
   erste Nachricht via `answerQuestion`.
4. Dock: Verlauf (User-Bubbles rechts, Antworten links, `detail-in`),
   Input unten, Esc/X schließt. Während Dock offen: Type-anywhere hängt
   Zeichen ans Dock-Input und fokussiert es.

## Umgesetzt
- [x] `answerQuestion` exportiert (`workspace-panels.tsx`).
- [x] `components/dashboard/command-search.tsx` — Overlay, Tastatur-Nav,
      role=dialog/aria-modal, Esc + Backdrop schließt, `overlay-in` +
      `backdrop-in` Tokens.
- [x] `components/dashboard/chat-dock.tsx` — Dock, Verlauf, Auto-Submit des
      Seeds, Type-anywhere→Input-Fokus.
- [x] `supplier-dashboard.tsx` — globaler Keydown (Guards: Modifier, editable
      Target, `[role=dialog]`, offene Panels), `overlaySeed`/`chatSeed`-State;
      Header-Button "Ask your analyst" öffnet jetzt den Dock; `AnalystSheet`-
      Wiring entfernt (Komponente bleibt exportiert in workspace-panels.tsx,
      wird in der Component-Factory-Phase wiederverwendet).
- [x] `globals.css` — `backdrop-in`, `overlay-in`, `dock-in` Keyframes+Tokens.
- [x] Verify: tsc/oxlint/eslint sauber; Browser-Test: Tippen→Overlay,
      Enter→Profil, Enter auf Ask→Dock mit korrekter Analyst-Antwort.

## Fix-Notizen
- Anti-Slop-Regel: keine Type-Assertions — `instanceof HTMLElement` statt
  `as HTMLElement`.
- `react-hooks/refs`: keine Ref-Updates während Render — Props direkt nutzen.

## Nachtrag: BorderBeam (libraries.dev/beam)
- `border-beam@1.4.1` installiert (bun).
- Beam um die Overlay-Suchleiste (`command-search.tsx`) und das Dock-Input
  (`chat-dock.tsx`): `size="md"`, `borderRadius` 12/10, `strength={0.85}`,
  `theme` aus `resolvedTheme` (auto folgt nur System, nicht dem App-Toggle).
