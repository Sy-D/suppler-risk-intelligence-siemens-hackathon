# Tech stack

Every framework, library, tool and external API used in this project, with the
version pinned in `bun.lock` or `deep-research-agent/requirements.txt`.

## External APIs and services

| Service | Used by | Purpose |
|---|---|---|
| [Nebius Token Factory](https://tokenfactory.nebius.com) | `deep-research-agent` | OpenAI-compatible inference API hosting the reasoning model **`MiniMaxAI/MiniMax-M3`**, which plans the research, reads search results and produces scores, reasons and reports. Endpoint `https://api.tokenfactory.nebius.com/v1`, key `NEBIUS_API_KEY`. |
| [Tavily Search API](https://tavily.com) | `deep-research-agent` | Web search built for LLM agents. Called with `search_depth="advanced"` and `max_results=5`; returns the pages and URLs that the reports cite. Key `TAVILY_API_KEY`. |

No other external service is called. The dashboard itself runs fully offline
on the bundled CSV dataset.

## Frontend and web server

| Package | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org) | 16.4.0 | App Router, Server Components, Route Handlers (`/api/research`, `/api/analyst`), Turbopack dev server |
| [React](https://react.dev) / React DOM | 19.3.0 | UI rendering |
| [TypeScript](https://www.typescriptlang.org) | 5.9.3 | Static typing |
| [Tailwind CSS](https://tailwindcss.com) | 4.3.3 | Styling, via `@tailwindcss/postcss` |
| [shadcn/ui](https://ui.shadcn.com) | 4.22.0 (CLI) | Component source in `components/ui/`, preset `b5JgvMPyq` (`base-maia`, Zinc) |
| [Base UI](https://base-ui.com) | 1.9.0 | Accessible headless primitives behind the shadcn components |
| [class-variance-authority](https://cva.style) | 0.7.1 | Component variants |
| [cn](https://www.npmjs.com/package/cn) | 0.5.0 | Class name merging |
| [tw-animate-css](https://www.npmjs.com/package/tw-animate-css) | 1.4.0 | Animation utilities |
| [NumberFlow](https://number-flow.barvian.me) (`@number-flow/react`) | 0.6.2 | Animated numbers on the fact cards |
| [Lucide](https://lucide.dev) (`lucide-react`) | 1.59.0 | Icons |
| [border-beam](https://www.npmjs.com/package/border-beam) | 1.4.1 | Animated border on the search overlay and chat dock |
| [next-themes](https://github.com/pacocoursey/next-themes) | 0.4.6 | Light/dark mode |
| [Geist](https://vercel.com/font) | via `next/font` | Sans and mono typefaces |

## Data layer

| Package | Version | Purpose |
|---|---|---|
| [DuckDB](https://duckdb.org) (`@duckdb/node-api`) | 1.5.6-r.1 | Embedded SQL engine; queries the dataset CSV and the agent's output CSV in-process |
| [zod](https://zod.dev) | 4.6.7 | Runtime validation of supplier rows and of analyst answer blocks |

Data files: `data/supplier_risk_dataset.csv` (10,000 anonymized suppliers,
provided for the hackathon) and `data/risk_criteria_description.md` (column
definitions).

## Deep research agent (Python 3.12)

| Package | Version | Purpose |
|---|---|---|
| [deepagents](https://github.com/langchain-ai/deepagents) | 0.7.28 | Deep Agent loop: planning, virtual filesystem, sub-agents |
| [LangChain](https://python.langchain.com) (`langchain`, `langchain-core`) | 1.4.6 / 1.6.12 | Agent and model abstractions, structured output |
| [langchain-nebius](https://pypi.org/project/langchain-nebius/) | 0.1.3 | `ChatNebius` chat model for Token Factory |
| [langchain-tavily](https://pypi.org/project/langchain-tavily/) | 0.2.18 | `TavilySearch` tool for the agent |
| [tavily-python](https://pypi.org/project/tavily-python/) | 0.8.5 | Tavily API client |
| [Pydantic](https://docs.pydantic.dev) | via LangChain | Score schema in `schema.py` |

The agent is based on the
[Nebius deep research agent cookbook](https://dev.nebius.com/cookbook/deep-research-agent-tavily).

## Tooling

| Tool | Version | Purpose |
|---|---|---|
| [Bun](https://bun.sh) | 1.4 | Package manager and script runner |
| [Node.js](https://nodejs.org) | ≥ 20.9 | Runtime for Next.js |
| [oxlint](https://oxc.rs/docs/guide/usage/linter) | 1.88.0 | Fast linter, plus custom "anti-slop" rules in `tools/oxlint/anti-slop/` |
| [ESLint](https://eslint.org) | 9.39.5 | `eslint-config-next` (core web vitals, TypeScript) |
| [Prettier](https://prettier.io) | 3.9.10 | Formatting, with `prettier-plugin-tailwindcss` |
| [Docker](https://www.docker.com) / Docker Compose | — | All-in-one image (`Dockerfile`, `compose.yml`): `oven/bun:1` for installs, `node:22-bookworm-slim` for the build, `python:3.12-bookworm` + Node.js 22 at runtime |
| [Mermaid](https://mermaid.js.org) | — | Diagrams in the documentation, rendered by GitHub |
