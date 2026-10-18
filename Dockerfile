# syntax=docker/dockerfile:1

# Full dependency install (dev deps needed for `next build`), using the bun
# lockfile for reproducibility.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Production-only node_modules for the runtime image.
FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# All-in-one runtime: Next.js plus the Python deep-research-agent. The API
# routes spawn the agent scripts per request (ANALYST_PYTHON), so no second
# long-running process or supervisor is needed.
FROM python:3.12-bookworm AS runner
# Copy Node.js/npm from the official node image (same Debian base).
COPY --from=node:22-bookworm-slim /usr/local /usr/local
WORKDIR /app
ENV NODE_ENV=production \
    ANALYST_PYTHON=/usr/local/bin/python3

COPY deep-research-agent/requirements.txt ./deep-research-agent/
# duckdb is needed by scripts/ask.py (analyst) and scripts/create_duckdb.py.
RUN pip install --no-cache-dir -r deep-research-agent/requirements.txt duckdb==1.5.6

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.ts ./
# data/supplier_risk_dataset.csv is read at request time via DuckDB.
COPY data ./data
COPY deep-research-agent/*.py ./deep-research-agent/
COPY scripts/*.py ./scripts/
# Build data/suppliers.duckdb for the analyst (scripts/ask.py).
RUN python3 scripts/create_duckdb.py

# output/ must be writable for the agent's CSV and JSONL results.
RUN useradd --create-home --uid 1001 app \
    && mkdir -p deep-research-agent/output \
    && chown -R app:app deep-research-agent/output
USER app

EXPOSE 3000
CMD ["npm", "start"]
