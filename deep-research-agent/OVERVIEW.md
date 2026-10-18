# Deep research agent — setup & process overview

A supplier-risk research agent built on the
[Nebius cookbook](https://dev.nebius.com/cookbook/deep-research-agent-tavily):
Tavily web search wired into LangChain agents driven by **MiniMax-M3** on
**Nebius Token Factory**. It powers two surfaces in this repo: the batch CSV
scoring pipeline and the dashboard's "Ask your analyst" / "Research a real
company" features.

## Pieces

| Component | Role |
|---|---|
| `app.py` | Batch pipeline: supplier names → risk scores → CSV/JSONL rows |
| `analyst.py` | Free-text Q&A: one question → cited report (used by "Ask your analyst") |
| `schema.py` | Pydantic score schema, CSV header order, level derivation, row/reasoning builders |
| `app/api/analyst/route.ts` | Next.js route: spawns `analyst.py`, returns `{answer}` |
| `app/api/research/route.ts` | Next.js route: spawns `app.py --json`, returns a dashboard `Supplier` |
| `lib/supplier-data.ts` | DuckDB union of dataset CSV + `output/suppliers.csv` (`RSCH_` ids) |

Model and search come from `langchain-nebius` (`ChatNebius`) and
`langchain-tavily` (`TavilySearch`, `max_results=5`,
`search_depth="advanced"`). Credentials are env-only: `NEBIUS_API_KEY`,
`NEBIUS_BASE_URL`, `NEBIUS_MODEL`, `TAVILY_API_KEY` — loaded from `.env` by
both entrypoints and never printed or committed.

## Process: batch scoring (`app.py`)

```
python app.py [--json] [--jobs N] [--criteria-jobs M] "Supplier" [...]
```

1. **Parse flags, assign ids** — supplier ids are assigned up front
   (`SUPP_00007+` continuing the CSV) so parallel workers can't race on the
   row count.
2. **Per supplier — 8 criteria sub-agents in parallel**
   (`--criteria-jobs`, default 4): each group — compliance/governance,
   financial/market, ESG/environmental, operations/quality/safety, labor,
   cyber, geopolitical/political, media/external-intel — gets a lightweight
   `create_react_agent` (model + Tavily tool) that searches and emits **its
   own schema fields directly** as a fenced JSON object:
   `{field: {score|value, reason, sources[]}}`.
3. **Merge** — the 8 group results validate into one `SupplierRiskScores`
   (20 fields: 18 scores + 2 enums). A failing group degrades to documented
   middle-range defaults instead of failing the supplier.
4. **Derive in code** — `level_for()` maps every score to Low/Medium/High/
   Critical (<25/<50/<75/≥75); `Total_Risk_Index` is the mean of the 18
   scores. Deterministic, consistent across rows.
5. **Persist** — under a write lock: row appended to
   `output/suppliers.csv` (46 columns, exact schema) and per-column
   `{value, reason, sources}` appended to
   `output/suppliers_reasoning.jsonl`.
6. **Emit** — printed table + reasoning, or `{"suppliers":[{row,reasoning}]}`
   with `--json` for the API route.

**Across suppliers** — `--jobs` (default 2) independent pipelines run in a
`ThreadPoolExecutor`. Total concurrency = `jobs × criteria_jobs` (default
2 × 4 = 8 concurrent searches). One supplier takes ~30s.

### Why this shape

- The original single deep-agent run + one big structured-extraction call
  took ~75–90s/supplier. Splitting research *and* scoring per criteria
  group, each in one model chain, cut it to ~30s.
- The focused criteria tasks use plain `create_react_agent` — fewer model
  turns than a full `deepagents` run, same tools.
- `invoke_until_text` retries when MiniMax leaks raw `]<]minimax[>`
  tool-call markup as the final message.

## Process: ask-the-analyst (`analyst.py`)

Single deep agent (`create_deep_agent` + Tavily) answers a free-text
question wrapped in a procurement-analyst prompt; returns the report text.
The Next.js sheet calls `POST /api/analyst` → spawns the script → JSON
answer.

## Process: research dialog (`app/api/research`)

`POST /api/research {name}` → spawns `app.py --json <name>` → maps the row
to a dashboard `Supplier` (`RSCH_` id space, `researched: true`) → client
adds it to the supplier list and auto-selects it for comparison.

## Data flow into the dashboard

`lib/supplier-data.ts` reads via **DuckDB** in one query:
`data/supplier_risk_dataset.csv` (10k anonymized rows) `UNION ALL`
`output/suppliers.csv` (agent rows remapped `SUPP_`→`RSCH_`). Researched
suppliers therefore persist across reloads; internal ERP columns show `—`.

## Failure modes

- Missing keys → exit 2 with `error: X is not set`
- Model markup leak → retry up to 3× (`invoke_until_text`)
- Bad/missing JSON from a criteria agent → group falls back to documented
  defaults
- `output/` and `.env` are gitignored; the Docker image runs as non-root
  with `ENTRYPOINT ["python", "app.py"]`
