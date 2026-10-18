"""Deep research agent: Tavily web search wired into a Deep Agent on Nebius Token Factory.

Reads credentials from the environment and never prints them:
  NEBIUS_API_KEY   - Token Factory API key (required)
  NEBIUS_BASE_URL  - Token Factory base URL (default: https://api.tokenfactory.nebius.com/v1)
  NEBIUS_MODEL     - model ID (default: MiniMaxAI/MiniMax-M3)
  TAVILY_API_KEY   - Tavily API key (required, read by the Tavily SDK)

Usage:
  python app.py ["Supplier Name" ["Another Supplier" ...]]

For each supplier the agent researches risk signals via web search, then a
structured-extraction call maps the evidence onto the supplier-risk CSV schema.
Rows are appended to output/suppliers.csv and printed as a table.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Sequence

from schema import (
    SupplierRiskScores,
    append_csv,
    build_row,
    next_supplier_id,
    render_table,
)

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3"
DEFAULT_SUPPLIERS = ["Robert Bosch GmbH"]
OUTPUT_CSV = Path("output/suppliers.csv")

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
"{supplier}". Rate the supplier on each dimension of the schema with an
integer 0-100 risk score where 0 = no discernible risk and 100 = extreme
risk. Note that 'health', 'stability', 'visibility' and 'performance'
dimensions are still scored as risk: a healthy supplier scores LOW.

Ground every score in the report's findings; if the report has no evidence
for a dimension, use a middle-range score. Also set sourcing_risk_level and
supply_chain_complexity to the most fitting allowed value.

Research report:
{report}
"""


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set. Export it and retry.")
    return value


def build_model():
    from langchain_nebius import ChatNebius

    return ChatNebius(
        model=os.environ.get("NEBIUS_MODEL", DEFAULT_MODEL),
        api_key=_require_env("NEBIUS_API_KEY"),
        base_url=os.environ.get("NEBIUS_BASE_URL", DEFAULT_BASE_URL),
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


def research(supplier: str, agent=None) -> str:
    """Run the deep research agent on one supplier and return the report text."""
    agent = agent if agent is not None else build_agent()
    result = agent.invoke(
        {"messages": [{"role": "user", "content": RESEARCH_PROMPT.format(supplier=supplier)}]}
    )
    return _message_content(result["messages"][-1])


def extract_scores(supplier: str, report: str, model=None) -> SupplierRiskScores:
    """Map a research report onto the score schema via the chat model."""
    model = model if model is not None else build_model()
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


def process_supplier(supplier: str, csv_path: Path = OUTPUT_CSV, agent=None, model=None) -> dict:
    report = research(supplier, agent=agent)
    scores = extract_scores(supplier, report, model=model)
    row = build_row(next_supplier_id(csv_path), supplier, scores)
    append_csv(csv_path, row)
    return row


def main(argv: Sequence[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    suppliers = argv or DEFAULT_SUPPLIERS
    try:
        rows = [process_supplier(name) for name in suppliers]
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for row in rows:
        print(render_table(row))
        print()
    print(f"Deep research report: {len(rows)} supplier row(s) written to {OUTPUT_CSV}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
