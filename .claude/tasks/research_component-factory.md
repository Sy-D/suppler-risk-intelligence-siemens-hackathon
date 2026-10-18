# Research — Generative UI / "Component Factory" for the Analyst Chat

Date: 2026-10-18 · Status: research complete, ready for planning
Related: `.claude/tasks/002_type-anywhere-chat-dock.md` (references this file)

## TL;DR

Replace the string-returning `answerQuestion` with a **typed answer composer** that
emits a JSON-ish tree of whitelisted UI blocks (`AnalystAnswer = { summary, blocks[] }`),
validated with zod and rendered through a **component registry**. Keep it client-side
for the hackathon (zero new deps, deterministic, demo-safe); a real LLM can later call
the same schema as a tool. Marvin Schwaibold's "component factory" thesis is exactly
this: the model may only play inside a strict constraint system — we define the
components, it picks and parametrizes.

---

## 1. Marvin Schwaibold — "Building a component factory with AI"

**Quelle:** vollständiger Post vom Autor bereitgestellt (2026-09-10,
marvinschwaibold.com). Kerninhalt:

- **Setup:** Er ließ das Modell (Astra) Komponenten von Grund auf designen.
  Der Durchbruch war ein simples Regelwerk: **8px-Pixel-Grid + Padding als
  Core-Primitives/Constraints**, die das Modell benutzen musste.
- **Constraints beschleunigen, nicht nur korrigieren:** "using the right
  constraints not only makes the model way more accurate but it actually speeds
  up the process" — Grid-Constraints machen Entscheidungen schneller, wie bei
  menschlichen Designern.
- **Font-Counter als Constraint:** bevor er die Schrift-Anzahl begrenzte,
  erfand das Modell zufällig neue Weights/Sizes → visueller Clutter. Fix:
  max. 2 Font-Familien (Inter + Baskerville), max. 3 Weights/Sizes pro
  Komponente.
- **Ergebnis:** nach ~1 Stunde ein kohärentes Komponenten-Set; dann **22
  Komponenten × 3 Layouts = 66 Varianten** — Layout-Varianten müssen zum
  Content passen (Music Player: Artwork groß vs. Controls vs. Queue).
- **"Render into reality":** eine Animation, die zeigt, wie jede Komponente
  durch die Regeln Gestalt annimmt — Sequenz: Pixel-Grid → Padding/Content-
  Areas → Struktur → Typografie → fertige Komponente. Macht Spacing
  "greifbar" und erklärt das System selbst.
- **Component factory:** Savee-Account angebunden (echte Bilder/Videos als
  Content), Komponenten in gestapelten Carousels, Kamera panned über das
  Canvas — "a shared set of rules supporting a growing collection of
  interfaces, each with its own content and purpose".
- **Meta-Lektion:** Fortschritt kam davon, Dinge die er als Designer seit
  Jahren tut explizit zu machen — "felt off → figured out why → turned it
  into a rule the model could use across the system".

### Was das für uns bedeutet (Update nach echtem Post)

1. Sein Post dreht sich um das **Generieren des Design-Systems** (Modell designt
   Komponenten in Constraints). Wir drehen es um: unser System steht schon, der
   "Composer" wählt + parametrisiert Blöcke. Gleiches Prinzip: closed
   vocabulary, bounded props, deterministisches Rendering.
2. Direkt klauenswert: sein **"Render into reality"-Reveal** (Grid → Padding →
   Struktur → Typografie → fertig). Übersetzung für den Chat: Answer-Blöcke
   erscheinen nicht auf einmal, sondern sequenziell — Summary-Text, dann
   Stat-Cards, dann Bars/Table (existierender 45 ms `detail-in`-Stagger,
      evtl. typabhängige Delays).
3. **Layout-Varianten pro Typ** (sein 22×3): unser Composer wählt je Intent ein
   anderes Block-Layout — Profile-Answer vs. Comparison-Answer vs.
   Ranking-Answer sind unsere "Varianten".

### His approach, generalized to our problem

| Principle | Meaning for us |
|---|---|
| Constraint-first, not free generation | The model never emits JSX/CSS — only picks from a finite, typed component vocabulary with a closed prop space. |
| Bounded combinatorial space | Fewer, stricter props > flexible props. `enum`s and small `max()` bounds everywhere. |
| Deterministic render | Generation is one inference; rendering is deterministic and free — the registry owns 100% of the visuals. |
| Volume + curation | Cheap to generate many variants; the value is a system strict enough that all of them are presentable. |
| Human in charge | Blocks should link back into app state (select supplier, open compare) so output is a starting point, not a dead end. |

This maps 1:1 onto the industry "server-driven UI" (SDUI) pattern: layout as data,
client as dumb renderer, zod as the contract.

---

## 2. Current best practices (React/Next.js, late 2026)

### 2a. Vercel AI SDK RSC (`ai/rsc`, `streamUI`) — do NOT use

`streamUI` streams React components from server to client; tools' `generate`
functions `yield` skeletons then `return` final components. **But `ai/rsc` is marked
experimental** and Vercel's own migration guide lists blocking limitations:

- components remount on `.done()` → flicker (issue 2939)
- many suspense boundaries → crashes (2843)
- no stream abort via server actions (React/Next #1122)
- `createStreamableUI` → quadratic data transfer; use `createStreamableValue` instead
- no parallel tool calls in `streamUI`

→ Recommendation: skip RSC streaming entirely. For a real LLM phase, use **AI SDK UI**.

### 2b. AI SDK UI (`useChat` + `streamText` + tool parts) — the supported path

- Server route: `streamText({ tools: { render_answer: { inputSchema: <zod>, execute? } } })`
  → `result.toUIMessageStreamResponse()`.
- Client: `useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) })`.
- Assistant messages have typed `parts`; a tool part (`tool-render_answer`) carries
  `input`/`output`. **Render the tool part with a registry component** — the tool
  call IS the UI description.
- Client-side/confirmation tools are handled via `onToolCall` + `addToolOutput`;
  `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` closes the loop.
- The model can also stream `text` parts around tool parts — so a chat answer can be
  prose + generated cards + prose.

### 2c. JSON-schema → component registry (SDUI pattern)

The contract: assistant emits `{ type, props }[]`; client owns a
`Record<key, Component>` map. Rules that make it robust:

- **Discriminated union on `type`** (zod `.discriminatedUnion`) — exhaustive, typed.
- **Validate per block, not per answer.** One bad block shouldn't kill valid siblings
  — drop/replace it with a text fallback.
- **Prefer references over values.** Emit `supplierId` + `dimension`; resolve numbers
  client-side from the already-loaded `Supplier[]`. The model can't hallucinate data
  it never sends — grounding for free.
- **Unknown `type` → fallback to plain text**, never crash, never render raw spec.
- Never eval model output or compile JSX — whitelist keys only.

### 2d. Partial-JSON streaming

Tool-call arguments stream as incomplete JSON. Options:

- Do nothing (recommended for us): our block trees are small (< 1–2 KB); render a
  skeleton while `part.state === "input-streaming"`, paint once on `output-available`.
- If progressive fill-in is wanted: tolerant parsers (`jsonchunk`,
  `@cacheplane/partial-json`, `streamschema`) yield `DeepPartial<T>` snapshots with
  per-field completion status. Never hand-roll regex JSON repair.

---

## 3. Codebase grounding (verified)

- `lib/supplier-data.ts` — `Supplier` type: `id` (`SUPP_\d{5}`), `name`, `risk`,
  `level` (`Low|Medium|High|Critical`), 8 dimension scores (`financial`, `quality`,
  `operational`, `compliance`, `esg`, `digital`, `governance`, `credit`),
  `delivery` (0–100), `exposure` (EUR), `sourcing`. Zod v4 already a dependency.
- `components/dashboard/workspace-panels.tsx:186-214` — rule-based `answerQuestion`
  returns a **string**; handles (a) financial comparisons, (b) supplier profiles via
  `SUPP_\d{5}` regex, (c) fallback text. Rendered at :262-268 as `whitespace-pre-line`.
- `AnalystSheet` (:216-317) — Sheet + prompt buttons + input; single `answer` state.
- `supplier-dashboard.tsx` — `panel` state drives `AnalystSheet`/`ComparisonDialog`/
  `ResearchDialog`; `setActiveSupplier`, `toggleSupplier` are the actions blocks
  should be able to trigger.
- Reusable primitives already exist: `RiskBar` (risk-bar.tsx), `RiskBadge` +
  `riskDimensions` + `euro` (risk-badge.tsx), `AnimatedNumber` + `deliveryFormat`/
  `exposureFormat` (animated-number.tsx), `Card`, `Badge`, `Table`, `Skeleton`.
- Task 002 plans a `chat-dock` — the registry renderer should be shared between
  `AnalystSheet` and the future dock.
- No `ai`/`@ai-sdk/*` deps yet; package manager is bun; verify with
  `pnpm typecheck` (`tsc --noEmit`) and `pnpm lint` (oxlint + eslint). Custom
  anti-slop oxlint rules forbid `any`-ish patterns — keep everything typed.

---

## 4. Implementation proposal

### 4.1 Schema — `lib/analyst/schema.ts` (new)

```ts
import { z } from "zod"

export const supplierId = z.string().regex(/^SUPP_\d{5}$/)
export const dimensionKey = z.enum([
  "risk", "financial", "quality", "operational", "compliance",
  "esg", "digital", "governance", "credit",
])

export const answerBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), markdown: z.string() }),
  z.object({                                            // one number, resolved client-side
    type: z.literal("stat"),
    label: z.string().max(60),
    supplierId, dimension: dimensionKey,
    hint: z.string().max(120).optional(),
  }),
  z.object({ type: z.literal("risk_bars"),              // named RiskBar, not StatCard
    supplierId,
    dimensions: z.array(dimensionKey).min(1).max(8),
    highlightTop: z.number().int().min(0).max(3).default(3),
  }),
  z.object({ type: z.literal("mini_table"),
    columns: z.array(z.enum(["name","risk","level","delivery","exposure"]))
      .min(1).max(4),
    supplierIds: z.array(supplierId).min(1).max(10),
    sortBy: z.enum(["risk","delivery","exposure"]).optional(),
    order: z.enum(["asc","desc"]).default("asc"),
  }),
  z.object({ type: z.literal("supplier_chips"),
    supplierIds: z.array(supplierId).min(1).max(20) }),
  z.object({ type: z.literal("callout"),
    tone: z.enum(["info","warning"]), text: z.string().max(280) }),
  z.object({ type: z.literal("source_note") }),         // fixed citation footer
])

export const analystAnswer = z.object({
  summary: z.string().max(400),                         // lead sentence(s)
  blocks: z.array(answerBlock).max(8),
})
export type AnswerBlock = z.infer<typeof answerBlock>
export type AnalystAnswer = z.infer<typeof analystAnswer>
```

Primitive inventory (maps to user ask): `stat` ≈ StatCard, `risk_bars` ≈ RiskBar,
`mini_table` ≈ MiniTable, `supplier_chips` ≈ SupplierChip, plus `text`, `callout`,
`source_note`. Note `summary` stays plain prose — the answer always has a readable
headline even if every block failed.

### 4.2 Registry + renderer — `components/analyst/registry.tsx` (new)

```tsx
const registry = {
  text: TextBlock,
  stat: StatBlock,
  risk_bars: RiskBarsBlock,
  mini_table: MiniTableBlock,
  supplier_chips: SupplierChipsBlock,
  callout: CalloutBlock,
  source_note: SourceNoteBlock,
} satisfies Record<AnswerBlock["type"], React.ComponentType<any>> // precise per-key props via union dispatch

export function AnswerBlocks({ answer, suppliers, actions }: Props) {
  const parsed = analystAnswer.safeParse(answer)
  if (!parsed.success) return <p>{answer.summary ?? String(answer)}</p> // whole-answer fallback
  return parsed.data.blocks.map((block, i) => {
    const single = answerBlock.safeParse(block)
    const Cmp = single.success ? registry[single.data.type] : TextBlock
    return <Cmp key={i} block={single.success ? single.data : { type: "text", markdown: JSON.stringify(block) }}
                suppliers={suppliers} actions={actions}
                className="motion-safe:animate-detail-in" style={{ animationDelay: `${i * 45}ms` }} />
  })
}
```

- `suppliers` resolves `supplierId` → `Supplier`; unknown ids degrade the block to a
  `text` mention (never a crash).
- `actions` is a small context: `{ openProfile(id), select(id), compare(ids) }`
  wiring blocks back to `setPanel`/`setActiveSupplier`/`toggleSupplier` in
  `supplier-dashboard.tsx` — this is what makes it *generative UI* rather than a
  static report.
- Reuse `animate-detail-in` stagger (45 ms, same as ComparisonDialog) for entrance.

### 4.3 Composer — `lib/analyst/compose.ts` (new, from `answerQuestion`)

Keep the existing intent detection; change the return type to `AnalystAnswer`:

- financial-comparison intent → `summary` + `mini_table` (sorted by `financial`)
  + `stat` on the winner + `callout` ("financial lead ≠ award recommendation")
  + `source_note`.
- profile intent → `summary` + `supplier_chips` + `stat` (risk) + `risk_bars`
  (top-3 dimensions via existing sort at workspace-panels.tsx:208-211)
  + `stat` (delivery) + `stat` (exposure) + `source_note`.
- fallback → `text` block only.

Optionally expose a "simulated streaming" — resolve composer synchronously, but
reveal blocks with the existing stagger so it *feels* generated.

### 4.4 Simulated vs. real LLM

**Keep client-side simulated for the hackathon demo.** Rationale: zero deps,
deterministic, no API key, no latency, no failure mode on stage — and the schema is
identical, so an LLM phase is a drop-in.

If a real model is wanted later: `app/api/chat/route.ts` with `streamText` + a
`compose_answer` tool whose `inputSchema` is `analystAnswer`; execute **client-side**
(suppliers are already in the client bundle — 10k rows are already shipped for the
dashboard) via `onToolCall` → validate → render tool part with `AnswerBlocks`.
Add `ai`, `@ai-sdk/react`, provider package + `AI_GATEWAY`/`ANTHROPIC_API_KEY`.
Keep the rule-based composer as fallback when the request fails or produces an
invalid tree.

### 4.5 Phased plan (hackathon-feasible)

- [ ] **P1 — Schema + composer (~2 h):** `lib/analyst/schema.ts`, `lib/analyst/compose.ts`;
      port `answerQuestion` intents to `AnalystAnswer`; unit-sanity via tsx/node run.
- [ ] **P2 — Blocks + registry (~3 h):** `components/analyst/blocks/*.tsx` reusing
      RiskBar/RiskBadge/AnimatedNumber/Table; `registry.tsx` renderer; wire into
      `AnalystSheet` (replace the `whitespace-pre-line` answer box at
      workspace-panels.tsx:262-268).
- [ ] **P3 — Interactive blocks (~1.5 h):** `AnalystActionsContext`; chips open
      profile, "add to compare" buttons drive `toggleSupplier`/`setPanel`. This is
      the demo moment.
- [ ] **P4 — Dock integration:** reuse `AnswerBlocks` in chat-dock (task 002) —
      composer + renderer already shared.
- [ ] **P5 (optional, only if time + API key):** `/api/chat` + `useChat`, tool part
      rendering; skeleton during `input-streaming`; keep rule-based fallback.

### 4.6 Pitfalls checklist

1. Don't use `ai/rsc`/`streamUI` (experimental; remount flicker, suspense crashes).
2. Model emits **references** (`supplierId`, `dimension`), not numbers — grounding.
3. Validate **per block**; unknown type → text fallback; whole-answer failure →
   `summary`/`text` only.
4. Bound everything (`max()` on strings/arrays) — a small closed vocabulary is the
   whole point of the component-factory idea.
5. Don't stream-render partial tool args for the demo; skeleton → final is fine.
   If needed later: `jsonchunk`/`@cacheplane/partial-json`, never regex.
6. No `any` (repo anti-slop oxlint rules); per-block props typed via the union.
7. Blocks must respect `prefers-reduced-motion` — reuse existing `motion-safe:` +
   `respectMotionPreference` conventions.
