# Deep research agent

A deep research agent based on the
[Nebius cookbook](https://dev.nebius.com/cookbook/deep-research-agent-tavily):
[Tavily](https://tavily.com) web search wired into a
[`deepagents`](https://github.com/langchain-ai/deepagents) Deep Agent driven by a
[Nebius Token Factory](https://tokenfactory.nebius.com) model.

The agent takes a research question, plans sub-questions, runs advanced Tavily
searches, reads the results, and returns a sourced report. Default question is
tailored to supplier-risk intelligence for this hackathon project.

- `MiniMaxAI/MiniMax-M3` on Token Factory as the reasoning model (`langchain-nebius`)
- `TavilySearch` as the agent's tool (`langchain-tavily`, `max_results=5`,
  `search_depth="advanced"`)
- `deepagents` supplies the planning loop, virtual filesystem, and sub-agents

## Prerequisites

- Python 3.12 or newer
- A Token Factory account with access to `MiniMaxAI/MiniMax-M3`
- A Tavily account and API key

## Local setup

```bash
cd deep-research-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in both keys — `app.py` and
`analyst.py` load it automatically (already exported variables win). Never
commit real keys. Alternatively, export them in your shell:

```bash
export NEBIUS_API_KEY="your-token-factory-key"
export TAVILY_API_KEY="your-tavily-key"
# optional overrides:
# export NEBIUS_BASE_URL="https://api.tokenfactory.nebius.com/v1"
# export NEBIUS_MODEL="MiniMaxAI/MiniMax-M3"
```

## Run

```bash
python app.py "Robert Bosch GmbH"                # one supplier
python app.py "Bosch" "Continental" "Schaeffler" # several suppliers, one row each
python app.py --jobs 8 "A" "B" "C" "D"           # up to 8 in parallel (default 4)
```

Each supplier is handled by an independent agent worker with its own model and
Tavily tool, so several suppliers research in parallel — `--jobs` caps
concurrency (default 4). Watch Tavily rate limits if you raise it.

For each supplier the deep agent researches risk signals via Tavily, then a
second model call maps the evidence onto the risk schema (see `schema.py`).
Each run appends one row per supplier to `output/suppliers.csv` and prints the
row as a table followed by the per-column reasoning and source URLs. The same
reasoning is appended as JSON to `output/suppliers_reasoning.jsonl` — one
object per supplier with `{value, reason, sources}` for every column, so the
score trail is auditable. `*_Level` columns and `Total_Risk_Index` are derived
in code (see `level_for`) so scoring stays consistent. The internal ERP columns
(`Purchase Order Volume (EUR)`, `Order Change Rate`, `Supplier Delivery
Rating`, `Order Confirmation Rate`) are left empty — they must come from an
ERP export, not web research.

A run makes several model calls and can take a minute or two per supplier —
that is expected.

## Ask-the-analyst mode

`analyst.py` answers a free-text question with a sourced report instead of the
CSV pipeline, and loads `.env` itself:

```bash
python analyst.py "What are the biggest current risk signals for Continental AG?"
```

The Next.js dashboard calls this via `app/api/analyst/route.ts` ("Ask your
analyst" button), which spawns `deep-research-agent/.venv/bin/python
analyst.py`. Override the interpreter with `ANALYST_PYTHON` if needed.

## Verify

A good run returns concrete, checkable specifics (named entities, dates,
figures) and the sources Tavily surfaced. If the output reads like a generic
summary with no sources, the search tool was never invoked — check that
`TAVILY_API_KEY` is set in the same environment.

## Docker

The image runs `app.py` as a non-root user; arguments after the image name are
supplier names. Mount `output/` to keep the CSV and JSONL results:

```bash
docker build -t deep-research-agent .
docker run --rm --env-file .env \
  -v "$PWD/output:/app/output" \
  deep-research-agent "Robert Bosch GmbH"
```

Without arguments it researches the default supplier. For the analyst mode,
override the entrypoint:

```bash
docker run --rm --env-file .env --entrypoint python \
  deep-research-agent analyst.py "your question here"
```

## Troubleshooting

- **401 from Token Factory**: the key is missing, expired, or scoped to a
  different project. Re-export `NEBIUS_API_KEY` and retry.
- **Empty or missing search results**: confirm the Tavily key is active and the
  plan has remaining credits.
- **`error: ... is not set` (exit code 2)**: export the named variable before
  running.
- **The run takes a minute or two**: expected — a research pass makes several
  model calls and advanced search depth is slower than basic.

## Clean up

```bash
deactivate && rm -rf .venv
unset NEBIUS_API_KEY TAVILY_API_KEY
```

If either key was ever pasted into a file, shell history, or a commit, rotate it
in the Token Factory console and the Tavily dashboard.
