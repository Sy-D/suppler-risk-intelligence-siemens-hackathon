# 003 — Component Factory: strukturierte Analyst-Antworten

Branch: `feat/type-anywhere-chat` (baut auf 002 auf)
Basis: `research_component-factory.md` (Schwaibold-Post + Best Practices)

## Umgesetzt

- [x] `lib/risk.ts` (neu): `riskDimensions` + `euro` aus `risk-badge.tsx`
      ins lib-Layer gehoben (re-export dort, bestehende Imports laufen).
- [x] `lib/analyst/schema.ts`: `analystAnswer = { summary, blocks[] }`,
      discriminated union: `text | stat | risk_bars | mini_table |
      supplier_chips | callout | source_note`. `statDimension` =
      9 Scores + delivery + exposure; `risk_bars` nur Score-Dims.
- [x] `lib/analyst/compose.ts`: `composeAnswer` — gleiche Intents wie
      `answerQuestion` (financ/finanz-Vergleich, SUPP_-Profil, Fallback),
      emittiert typisierte Blöcke mit `supplierId`-Referenzen.
- [x] `components/analyst/blocks.tsx`: Renderer (Stat = AnimatedNumber-Card,
      RiskBars = sortierte RiskBar-Liste mit Top-Highlight, MiniTable =
      sortierbare kompakte Tabelle, SupplierChips → `onOpenProfile`,
      Callout info/warning, SourceNote, Text).
- [x] `components/analyst/answer-blocks.tsx`: `AnswerBlocks` —
      `analystAnswer.safeParse` auf Answer-Ebene, `answerBlock.safeParse`
      pro Block, Fallback auf Text; 45 ms `detail-in`-Stagger (Schwaibolds
      "Render into reality"-Sequenz).
- [x] `chat-dock.tsx`: Messages typisiert (user text / assistant answer),
      `composeAnswer` + `AnswerBlocks` mit `onOpenProfile` → Chip öffnet
      Supplier-Profil-Card.
- [x] `supplier-dashboard.tsx`: `onOpenProfile={setActiveSupplier}` verdrahtet.
- [x] Verify: tsc/oxlint/eslint sauber. Browser: Profil-Frage → Chips + Stat +
      RiskBars + Stats + SourceNote; Financial-Frage → MiniTable (3 Supplier,
      nach financial sortiert) + Stat + Callout. Anti-Slop: kein `typeof`/
      Assertions (zod `safeParse` stattdessen), kein `any`.

## Offen
- Echtes LLM/`/api/chat` (P5) — Schema ist drop-in-kompatibel.
- AnalystSheet bleibt verdrahtungslos (Dock ersetzt es); kann später ebenfalls
  `AnswerBlocks` rendern.
- Noch nicht committed.
