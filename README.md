# Supplier risk intelligence

A Siemens Mobility hackathon dashboard for exploring 10,000 anonymized suppliers, understanding their risk profiles and building a shortlist.

## Local development

```sh
bun install
bun run dev
```

Open http://localhost:3000.

## Docker

A single image runs the dashboard and the deep-research agent — the API
routes spawn the agent's Python scripts in the same container:

```sh
docker compose up --build
```

Open http://localhost:3000. Copy `.env.example` to `.env` at the repo root
and fill in `NEBIUS_API_KEY` and `TAVILY_API_KEY` first — the app works
without keys but the research and analyst features will fail. Research
results persist in the `agent-output` volume.

"Ask your analyst" runs `scripts/ask.py`, which turns the question into SQL
over `data/suppliers.duckdb` (built from the CSV by `scripts/create_duckdb.py`;
the Docker image does this at build time). Locally, run
`.venv/bin/python scripts/create_duckdb.py` once. Override the interpreter or
script with `ANALYST_PYTHON` / `ANALYST_SCRIPT`.

## Interface

The dashboard uses the original shadcn preset `b5JgvMPyq` (`base-maia`, Zinc, Geist), with NumberFlow on the four portfolio fact cards. Table headers toggle ascending/descending sorting. Both searches offer keyboard-accessible supplier suggestions. Risk level, maximum total/financial risk, minimum delivery and sourcing-risk filters narrow the portfolio.

Select up to 20 table rows to focus the chart and fact cards on that selection. Chart search and filters further narrow that view without changing the table. Clicking a point opens its supplier profile in the right sidebar (a sheet on smaller screens); choosing a chart search suggestion offers the same action from the keyboard. Clear the selection to return to table results.

Risk colors use distinct green, amber, orange and red bands, with Critical shown in red and a text label. NumberFlow and transform-based animations cover risk bars and fact cards, respecting reduced-motion preferences. Compare selected risk profiles or export a shortlist memo.

Data is included in `data/supplier_risk_dataset.csv`; column descriptions are in `data/risk_criteria_description.md`. All risk scores run from 0 (no risk) to 100 (maximum risk). Higher delivery ratings are better. Exact total-risk weights, component groups, company locations and historical snapshots are not provided.

The analyst currently answers CSV-based example questions. The external research agent is a workflow preview; live model and research integrations are not connected yet.

## Checks

```sh
bun run lint
bun run typecheck
bun run build
```

The earlier static design snapshot (before the interactive filter enhancements) is `design/mockups/supplier-workspace.html`. Use the running application to see the number animations and interactions.
