FROM python:3.12-slim

# Create non-root user
RUN groupadd -r celery && useradd -r -g celery celery

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy shared schemas first so dependency install can reference them
COPY packages/ai-schemas ./packages/ai-schemas

# Prepare service directory for dependency installation
WORKDIR /app/services/ai-service
COPY services/ai-service/pyproject.toml ./pyproject.toml

# Install dependencies
RUN uv pip install --system -r pyproject.toml

# Copy application code and set ownership
COPY --chown=celery:celery services/ai-service/ .

# Switch to non-root user
USER celery

# Default to running the API (worker runs separately)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
