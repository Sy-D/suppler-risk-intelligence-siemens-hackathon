"""Deep research agent: Tavily web search wired into a Deep Agent on Nebius Token Factory.

Reads credentials from the environment and never prints them:
  NEBIUS_API_KEY   - Token Factory API key (required)
  NEBIUS_BASE_URL  - Token Factory base URL (default: https://api.tokenfactory.nebius.com/v1)
  NEBIUS_MODEL     - model ID (default: MiniMaxAI/MiniMax-M3)
  TAVILY_API_KEY   - Tavily API key (required, read by the Tavily SDK)

Usage:
  python app.py [--json] [--jobs N] ["Supplier Name" ["Another Supplier" ...]]

Each supplier is researched by an independent agent worker (own model + search
tool) and up to --jobs suppliers run in parallel. For each supplier the agent
researches risk signals via web search, then a structured-extraction call maps
the evidence onto the supplier-risk CSV schema. Rows are appended to
output/suppliers.csv and printed as a table (or emitted as JSON with --json).
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Sequence

from schema import (
    SupplierRiskScores,
    append_csv,
    append_jsonl,
    build_reasoning,
    build_row,
    next_supplier_id,
    render_reasoning,
    render_table,
)

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3"
DEFAULT_SUPPLIERS = ["Robert Bosch GmbH"]
OUTPUT_CSV = Path("output/suppliers.csv")
REASONING_JSONL = Path("output/suppliers_reasoning.jsonl")
ENV_FILE = Path(__file__).resolve().parent / ".env"


def load_env_file(path: Path = ENV_FILE) -> None:
    """Set env vars from a local .env file without overriding existing ones."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

RESEARCH_PROMPT = (
    "You are researching supplier risk for procurement due diligence. "
    "Investigate the supplier '{supplier}' using web search. Cover: sanctions "
    "and compliance exposure, financial health and credit signals, ESG and "
    "environmental exposure, labor disputes and workforce stability, safety "
    "incidents, product-quality or recall history, cyber-security incidents, "
    "geopolitical exposure of HQ and key sites, market sentiment, ownership "
    "and governance issues, and supply-chain/sub-tier visibility. Cite a "
    "source for every material finding."
)

EXTRACTION_PROMPT = """\
You are scoring supplier risk. Below is a research report on the supplier
"{supplier}". For each dimension of the schema return:

- score: integer 0-100 risk score where 0 = no discernible risk and
  100 = extreme risk. Note that 'health', 'stability', 'visibility' and
  'performance' dimensions are still scored as risk: a healthy supplier
  scores LOW.
- reason: 1-2 sentences citing the concrete findings the score is based on.
- sources: the source URLs from the report that support the score.

Ground every score in the report's findings; if the report has no evidence
for a dimension, use a middle-range score, say so in the reason, and leave
sources empty. Also set sourcing_risk_level and supply_chain_complexity to
the most fitting allowed value, each with its own reason and sources.

Research report:
{report}
"""


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Export it and retry.")
    return value


def _env_or_default(name: str, default: str) -> str:
    # An empty value (e.g. a blank line copied from .env.example) falls back too.
    return os.environ.get(name) or default


def build_model(max_tokens: int | None = None):
    from langchain_nebius import ChatNebius

    return ChatNebius(
        model=_env_or_default("NEBIUS_MODEL", DEFAULT_MODEL),
        api_key=_require_env("NEBIUS_API_KEY"),
        base_url=_env_or_default("NEBIUS_BASE_URL", DEFAULT_BASE_URL),
        max_tokens=max_tokens,
    )


def build_tools() -> list:
    _require_env("TAVILY_API_KEY")
    from langchain_tavily import TavilySearch

    return [TavilySearch(max_results=5, search_depth="advanced")]


def build_agent(model=None, tools=None):
    from deepagents import create_deep_agent

    return create_deep_agent(
        model=model if model is not None else build_model(),
        tools=tools if tools is not None else build_tools(),
    )


def _message_content(message) -> str:
    content = getattr(message, "content", message)
    return content if isinstance(content, str) else str(content)


_MARKUP = re.compile(r"<\/?(?:tool_call|invoke)\b|\]<\]minimax")


def last_report_text(result: dict) -> str | None:
    """Return the latest message content that is real text — the model can
    occasionally leak unparsed tool-call markup as the last message."""
    for message in reversed(result["messages"]):
        content = getattr(message, "content", "")
        if isinstance(content, str) and content.strip() and not _MARKUP.search(content):
            return content
    return None


def invoke_until_text(agent, prompt: str, attempts: int = 3) -> str:
    """Invoke the agent until it produces a clean final text (retry on markup leaks)."""
    for _ in range(attempts):
        text = last_report_text(agent.invoke({"messages": [{"role": "user", "content": prompt}]}))
        if text:
            return text
    raise RuntimeError("the agent returned no usable answer — retry the run")


def research(supplier: str, agent=None) -> str:
    """Run the deep research agent on one supplier and return the report text."""
    agent = agent if agent is not None else build_agent()
    return invoke_until_text(agent, RESEARCH_PROMPT.format(supplier=supplier))


def extract_scores(supplier: str, report: str, model=None) -> SupplierRiskScores:
    """Map a research report onto the score schema via the chat model."""
    model = model if model is not None else build_model(max_tokens=8192)
    prompt = EXTRACTION_PROMPT.format(supplier=supplier, report=report)
    try:
        extractor = model.with_structured_output(SupplierRiskScores)
        return extractor.invoke(prompt)
    except Exception:
        raw = _message_content(model.invoke(prompt))
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise RuntimeError("model returned no JSON for supplier scores")
        return SupplierRiskScores.model_validate(json.loads(match.group(0)))


_WRITE_LOCK = threading.Lock()


def _row_count(path: Path) -> int:
    return sum(1 for _ in path.open()) - 1 if path.exists() else 0


def process_supplier(
    supplier: str,
    supplier_id: str | None = None,
    csv_path: Path = OUTPUT_CSV,
    jsonl_path: Path = REASONING_JSONL,
    agent=None,
    model=None,
) -> tuple[dict, dict]:
    report = research(supplier, agent=agent)
    scores = extract_scores(supplier, report, model=model)
    with _WRITE_LOCK:
        row = build_row(supplier_id or next_supplier_id(csv_path), supplier, scores)
        reasoning = build_reasoning(row, scores)
        append_csv(csv_path, row)
        append_jsonl(jsonl_path, reasoning)
    return row, reasoning


def _parse_flags(argv: list[str]) -> tuple[bool, int, list[str]]:
    """Split CLI args into (json_mode, jobs, supplier names)."""
    json_mode, jobs, suppliers = False, 4, []
    it = iter(argv)
    for arg in it:
        if arg == "--json":
            json_mode = True
        elif arg in ("-j", "--jobs"):
            jobs = int(next(it, "4"))
        elif arg.startswith("--jobs="):
            jobs = int(arg.split("=", 1)[1])
        else:
            suppliers.append(arg)
    return json_mode, max(1, jobs), suppliers


def main(argv: Sequence[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    json_mode, jobs, suppliers = _parse_flags(argv)
    suppliers = suppliers or DEFAULT_SUPPLIERS
    # Assign ids up front so parallel workers cannot race on the row count.
    base = _row_count(OUTPUT_CSV)
    tasks = [(name, f"SUPP_{base + i + 1:05d}") for i, name in enumerate(suppliers)]
    try:
        with ThreadPoolExecutor(max_workers=min(jobs, len(tasks))) as pool:
            results = list(
                pool.map(lambda task: process_supplier(task[0], task[1]), tasks)
            )
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if json_mode:
        print(
            json.dumps(
                {
                    "suppliers": [
                        {"row": row, "reasoning": reasoning} for row, reasoning in results
                    ]
                }
            )
        )
        return 0
    for row, reasoning in results:
        print(render_table(row))
        print()
        print(render_reasoning(reasoning))
        print()
    print(f"Deep research report: {len(results)} supplier row(s) written to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    load_env_file()
    raise SystemExit(main())
