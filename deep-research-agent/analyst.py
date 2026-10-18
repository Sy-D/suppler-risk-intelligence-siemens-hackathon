"""Ask-the-analyst entrypoint: answer a free-text supplier-risk question.

Loads credentials from deep-research-agent/.env (if present) so the script can
be spawned by the Next.js API route without extra wiring.

Usage:
  python analyst.py "What are the main risk signals for Continental AG?"
"""

from __future__ import annotations

import sys

from app import load_env_file


ANALYST_PROMPT = (
    "You are a procurement risk analyst for an industrial manufacturer. "
    "Answer the question below using web research. Ground every material "
    "claim in a named source with a link. Be direct about uncertainty. "
    "Reply with the final answer only, without remarks about your process.\n\n"
    "Question: {question}"
)


def ask(question: str, agent=None) -> str:
    from app import build_agent, invoke_until_text

    agent = agent if agent is not None else build_agent()
    return invoke_until_text(agent, ANALYST_PROMPT.format(question=question))


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    question = argv[0] if argv else "What are current supply-chain risk signals?"
    try:
        print(ask(question))
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    load_env_file()
    raise SystemExit(main())
