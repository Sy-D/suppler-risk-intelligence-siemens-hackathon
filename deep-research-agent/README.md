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
# for running the tests:
pip install -r requirements-dev.txt
```

Export both credentials (or copy `.env.example` to `.env` and source it — never
commit real keys):

```bash
export NEBIUS_API_KEY="your-token-factory-key"
export TAVILY_API_KEY="your-tavily-key"
# optional overrides:
# export NEBIUS_BASE_URL="https://api.tokenfactory.nebius.com/v1"
# export NEBIUS_MODEL="MiniMaxAI/MiniMax-M3"
```

## Run

```bash
python app.py                                    # default supplier-risk question
python app.py "Research the financial health and sanctions exposure of <supplier>."
```

A successful run prints the final report on one line prefixed exactly with
`Deep research report:` and exits with code 0. A run makes several model calls
and can take a minute or two — that is expected.

## Verify

A good run returns concrete, checkable specifics (named entities, dates,
figures) and the sources Tavily surfaced. If the output reads like a generic
summary with no sources, the search tool was never invoked — check that
`TAVILY_API_KEY` is set in the same environment.

## Tests

Tests stub both the model client and the search tool, so they run without any
credentials or network access:

```bash
pytest tests/ -v
```

## Docker

```bash
docker build -t deep-research-agent .
docker run --rm \
  -e NEBIUS_API_KEY -e TAVILY_API_KEY \
  -e NEBIUS_BASE_URL -e NEBIUS_MODEL \
  deep-research-agent
```

The container runs one research pass for the default question and exits. Pass a
question as an argument to override it:

```bash
docker run --rm -e NEBIUS_API_KEY -e TAVILY_API_KEY \
  deep-research-agent "your question here"
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
