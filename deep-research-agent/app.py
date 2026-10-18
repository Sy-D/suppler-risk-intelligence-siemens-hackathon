"""Deep research agent: Tavily web search wired into a Deep Agent on Nebius Token Factory.

Reads credentials from the environment and never prints them:
  NEBIUS_API_KEY   - Token Factory API key (required)
  NEBIUS_BASE_URL  - Token Factory base URL (default: https://api.tokenfactory.nebius.com/v1)
  NEBIUS_MODEL     - model ID (default: MiniMaxAI/MiniMax-M3)
  TAVILY_API_KEY   - Tavily API key (required, read by the Tavily SDK)

Usage:
  python app.py ["research question"]
"""

from __future__ import annotations

import os
import sys
from typing import Sequence

DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
DEFAULT_MODEL = "MiniMaxAI/MiniMax-M3"
DEFAULT_QUESTION = (
    "Research the biggest supply-chain risk signals affecting European "
    "industrial suppliers in 2026 and write a detailed, sourced report."
)


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


def run(question: str, agent=None) -> str:
    agent = agent if agent is not None else build_agent()
    result = agent.invoke({"messages": [{"role": "user", "content": question}]})
    last = result["messages"][-1]
    content = getattr(last, "content", last)
    return content if isinstance(content, str) else str(content)


def main(argv: Sequence[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    question = argv[0] if argv else DEFAULT_QUESTION
    try:
        report = run(question)
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(f"Deep research report: {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
