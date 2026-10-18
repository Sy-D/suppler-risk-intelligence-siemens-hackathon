"""Deep research agent: Tavily web search wired into a Deep Agent on Nebius Token Factory.

Reads credentials from the environment and never prints them:
  NEBIUS_API_KEY   - Token Factory API key (required)
  NEBIUS_BASE_URL  - Token Factory base URL (default: https://api.tokenfactory.nebius.com/v1)
  NEBIUS_MODEL     - model ID (default: MiniMaxAI/MiniMax-M3)
  TAVILY_API_KEY   - Tavily API key (required, read by the Tavily SDK)

Usage:
  python app.py [--json] [--jobs N] [--criteria-jobs M] ["Supplier" ...]

Two levels of parallelism: --jobs suppliers run at once (default 2), and each
supplier's research is fanned out to --criteria-jobs focused sub-agents, one
per risk-criteria group (default 4). A structured-extraction call then maps
the combined evidence onto the supplier-risk CSV schema. Rows are appended to
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
    ComplexityChoice,
    ScoredDimension,
    SourcingRiskChoice,
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
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"  # repo root .env


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

# Each group is investigated by an independent sub-agent that searches in
# parallel; the briefs are combined into one evidence pack for scoring.
CRITERIA_GROUPS = [
    (
        "Compliance & governance",
        "sanctions-list hits, regulatory investigations, antitrust/compliance "
        "violations, ownership structure, PEP exposure, governance controversies. "
        "Prefer official sources: OFAC SDN list, EU consolidated sanctions "
        "list, BaFin/FATF, DOJ/SEC actions, court records, company registers",
    ),
    (
        "Financial & market",
        "financial health, credit rating, earnings and debt signals, market "
        "sentiment, analyst views, share-price movement. Prefer authoritative "
        "sources: audited annual reports, S&P/Moody's/Fitch ratings, "
        "SEC/Bundesanzeiger filings, investor-relations pages",
    ),
    (
        "ESG & environmental",
        "ESG ratings, environmental exposure, climate/deforestation/CBAM "
        "risks, sustainability report findings. Prefer rating providers and "
        "primary disclosures: CDP scores, Sustainalytics/MSCI ESG, EcoVadis, "
        "the company's own sustainability report",
    ),
    (
        "Operations, quality & safety",
        "production disruptions, product recalls and quality defects, safety "
        "incidents, operational resilience, sub-tier supplier visibility, "
        "supply-chain complexity. Prefer regulator databases: NHTSA, EU "
        "Safety Gate/RAPEX recalls, OSHA, FDA, HSE",
    ),
    (
        "Labor",
        "strikes, layoffs, union and works-council disputes, workforce "
        "stability, labor-law issues. Prefer union/works-council "
        "announcements, company statements and reputable business press",
    ),
    (
        "Cyber security",
        "data breaches, ransomware, security incidents, IT/OT security "
        "posture, disclosed vulnerabilities. Prefer breach disclosures, "
        "CERT advisories, and established security news outlets",
    ),
    (
        "Geopolitical & political",
        "country risk of HQ and key sites, sanctions and export-control "
        "exposure, political stability, tariffs and trade restrictions. "
        "Prefer index/institutional sources: World Bank WGI, official "
        "policy announcements, trade-ministry statements",
    ),
    (
        "Media & external intelligence",
        "adverse media coverage, reputational signals, industry benchmark "
        "position, external risk-intelligence mentions. Prefer established "
        "outlets: Reuters, Bloomberg, FT, major national press",
    ),
]

# Maps each criteria group to the schema fields its sub-agent must score.
GROUP_FIELDS = {
    "Compliance & governance": ["compliance_risk", "governance_risk"],
    "Financial & market": ["financial_health", "credit_rating", "market_sentiment"],
    "ESG & environmental": ["esg_performance", "environmental_exposure"],
    "Operations, quality & safety": [
        "operational_resilience",
        "quality_risk",
        "safety_incident",
        "sub_tier_visibility",
        "supply_chain_complexity",
    ],
    "Labor": ["labor_stability"],
    "Cyber security": ["digital_security"],
    "Geopolitical & political": ["geopolitical_risk", "political_stability"],
    "Media & external intelligence": [
        "media_sentiment",
        "external_intelligence",
        "industry_benchmark",
        "sourcing_risk_level",
    ],
}

CRITERIA_PROMPT = (
    "You are researching supplier risk for procurement due diligence. "
    "Investigate ONLY this area for the supplier '{supplier}': {focus}. "
    "Use web search. Return a tight bullet brief of concrete findings with a "
    "source link for each — do not cover other risk areas."
)

CRITERIA_SCORE_PROMPT = """\
You are scoring supplier risk for "{supplier}". Investigate ONLY this area:
{focus}. Use web search to find concrete evidence, then END YOUR REPLY with a
fenced ```json object mapping each of these fields to its result:

{spec}

Rules: score fields use {{"score": <int 0-100, higher = more risk>,
"reason": <1-2 sentences citing findings>, "sources": [<urls>]}}; enum fields
use {{"value": <one of the listed values>, "reason": ..., "sources": [...]}}.
'health'/'stability'/'visibility'/'performance' dimensions are still risk
scores — a healthy supplier scores LOW. No evidence → middle-range score and
say so in the reason. Nothing after the JSON block.\
"""

_FIELD_MODELS = {
    "sourcing_risk_level": SourcingRiskChoice,
    "supply_chain_complexity": ComplexityChoice,
}


def _fallback_for(field: str):
    if field == "sourcing_risk_level":
        return SourcingRiskChoice(value="Medium", reason="scoring failed — default")
    if field == "supply_chain_complexity":
        return ComplexityChoice(value="Complex", reason="scoring failed — default")
    return ScoredDimension(score=50, reason="scoring failed — middle-range default")

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


def build_react_agent():
    """Lightweight agent for a single focused research task — fewer model
    turns than the full deep agent, so criteria briefs finish faster."""
    from langgraph.prebuilt import create_react_agent

    return create_react_agent(build_model(), tools=build_tools())


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


def progress(label: str, text: str) -> None:
    """Emit one live progress line for the API route / CLI (stderr only)."""
    print(f"PROGRESS|{label}|{text}", file=sys.stderr, flush=True)


def _progress_handler_class():
    from langchain_core.callbacks import BaseCallbackHandler

    class ProgressHandler(BaseCallbackHandler):
        """Relays each tool call as a short, user-readable progress line."""

        def __init__(self, label: str):
            self.label = label

        def on_tool_start(self, serialized, input_str, **_kwargs) -> None:
            query = None
            try:
                query = json.loads(input_str).get("query")
            except (json.JSONDecodeError, AttributeError):
                query = None
            progress(
                self.label,
                f"searching: {query}" if query else "gathering information",
            )

        def on_tool_end(self, output, **_kwargs) -> None:
            progress(self.label, "reading sources")

    return ProgressHandler


def invoke_until_text(agent, prompt: str, attempts: int = 3, label: str = "agent") -> str:
    """Invoke the agent until it produces a clean final text (retry on markup leaks)."""
    config = {"callbacks": [_progress_handler_class()(label)]}
    for _ in range(attempts):
        text = last_report_text(
            agent.invoke(
                {"messages": [{"role": "user", "content": prompt}]}, config=config
            )
        )
        if text:
            return text
    raise RuntimeError("the agent returned no usable answer — retry the run")


def research(supplier: str, agent=None, criteria_jobs: int = 4) -> str:
    """Research one supplier: a focused sub-agent per criteria group runs in
    parallel and their briefs are combined into one evidence pack."""
    if agent is not None:
        return invoke_until_text(agent, RESEARCH_PROMPT.format(supplier=supplier))
    # Scores are discarded here — callers needing scores use score_supplier.
    return _combined_brief(supplier, criteria_jobs)


def _combined_brief(supplier: str, criteria_jobs: int = 4) -> str:
    """Run a criteria sub-agent per group in parallel and join the briefs."""

    def brief(group: tuple[str, str]) -> str:
        title, focus = group
        progress(title, "started")
        text = invoke_until_text(
            build_react_agent(),
            CRITERIA_PROMPT.format(supplier=supplier, focus=focus),
            label=title,
        )
        progress(title, "done")
        return f"## {title}\n{text}"

    with ThreadPoolExecutor(max_workers=min(criteria_jobs, len(CRITERIA_GROUPS))) as pool:
        return "\n\n".join(pool.map(brief, CRITERIA_GROUPS))


def _field_spec(field: str) -> str:
    if field == "sourcing_risk_level":
        return f'"{field}": {{"value": "Low" | "Medium" | "High" | "Critical", "reason": str, "sources": [str]}}'
    if field == "supply_chain_complexity":
        return f'"{field}": {{"value": "Simple" | "Moderate" | "Complex" | "Very Complex", "reason": str, "sources": [str]}}'
    return f'"{field}": {{"score": int 0-100, "reason": str, "sources": [str]}}'


def _extract_json(text: str) -> dict:
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    blob = fenced.group(1) if fenced else None
    if blob is None:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        blob = match.group(0) if match else None
    if blob is None:
        raise RuntimeError("no JSON in criteria agent output")
    return json.loads(blob)


def _group_scores(supplier: str, title: str, focus: str) -> dict:
    """One criteria pipeline: a single sub-agent searches and emits this
    group's scores directly. Isolated failures degrade to defaults."""
    fields = GROUP_FIELDS[title]
    try:
        prompt = CRITERIA_SCORE_PROMPT.format(
            supplier=supplier,
            focus=focus,
            spec="\n".join(_field_spec(f) for f in fields),
        )
        progress(title, "started")
        text = invoke_until_text(build_react_agent(), prompt, label=title)
        progress(title, "done")
        data = _extract_json(text)
        return {
            f: _FIELD_MODELS.get(f, ScoredDimension).model_validate(data[f])
            for f in fields
        }
    except Exception:
        return {f: _fallback_for(f) for f in fields}


def resolve_name(name: str, model=None) -> str:
    """Resolve a casual input ('stadler') to the canonical company name via a
    single cheap model call; falls back to the input unchanged."""
    try:
        model = model if model is not None else build_model(max_tokens=64)
        text = _message_content(
            model.invoke(
                f'What is the full official name of the company commonly called '
                f'"{name}"? Reply with only the company name on one line, no '
                f'explanation. If unclear, reply with "{name}" unchanged.'
            )
        ).strip().strip('"')
        return text or name
    except Exception:
        return name


def score_supplier(supplier: str, criteria_jobs: int = 4) -> SupplierRiskScores:
    """Run all criteria pipelines in parallel and merge into the full schema."""
    with ThreadPoolExecutor(max_workers=min(criteria_jobs, len(CRITERIA_GROUPS))) as pool:
        groups = list(pool.map(lambda g: _group_scores(supplier, *g), CRITERIA_GROUPS))
    merged = {field: value for group in groups for field, value in group.items()}
    return SupplierRiskScores(**merged)


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
    criteria_jobs: int = 4,
    agent=None,
    model=None,
) -> tuple[dict, dict]:
    if agent is not None:
        report = research(supplier, agent=agent, criteria_jobs=criteria_jobs)
        scores = extract_scores(supplier, report, model=model)
    else:
        scores = score_supplier(supplier, criteria_jobs=criteria_jobs)
    with _WRITE_LOCK:
        row = build_row(supplier_id or next_supplier_id(csv_path), supplier, scores)
        reasoning = build_reasoning(row, scores)
        append_csv(csv_path, row)
        append_jsonl(jsonl_path, reasoning)
    return row, reasoning


def _parse_flags(argv: list[str]) -> tuple[bool, int, int, list[str]]:
    """Split CLI args into (json_mode, jobs, criteria_jobs, supplier names)."""
    json_mode, jobs, criteria_jobs, suppliers = False, 2, 4, []
    it = iter(argv)
    for arg in it:
        if arg == "--json":
            json_mode = True
        elif arg in ("-j", "--jobs"):
            jobs = int(next(it, "2"))
        elif arg.startswith("--jobs="):
            jobs = int(arg.split("=", 1)[1])
        elif arg == "--criteria-jobs":
            criteria_jobs = int(next(it, "4"))
        elif arg.startswith("--criteria-jobs="):
            criteria_jobs = int(arg.split("=", 1)[1])
        else:
            suppliers.append(arg)
    return json_mode, max(1, jobs), max(1, criteria_jobs), suppliers


def main(argv: Sequence[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if "--resolve" in argv:
        argv.remove("--resolve")
        _json, _j, _c, names = _parse_flags(argv)
        print(json.dumps({"canonical": resolve_name((names or DEFAULT_SUPPLIERS)[0])}))
        return 0
    json_mode, jobs, criteria_jobs, suppliers = _parse_flags(argv)
    suppliers = suppliers or DEFAULT_SUPPLIERS
    # Assign ids up front so parallel workers cannot race on the row count.
    base = _row_count(OUTPUT_CSV)
    tasks = [(name, f"SUPP_{base + i + 1:05d}") for i, name in enumerate(suppliers)]
    try:
        with ThreadPoolExecutor(max_workers=min(jobs, len(tasks))) as pool:
            results = list(
                pool.map(
                    lambda task: process_supplier(
                        task[0], task[1], criteria_jobs=criteria_jobs
                    ),
                    tasks,
                )
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
