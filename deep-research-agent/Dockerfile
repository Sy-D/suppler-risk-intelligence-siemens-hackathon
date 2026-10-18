FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./

# Run as non-root; output/ must be writable for the CSV and JSONL results.
RUN useradd --create-home --uid 1000 agent \
    && mkdir output && chown agent:agent output
USER agent

# Arguments after the image name are supplier names (or --json).
ENTRYPOINT ["python", "app.py"]
