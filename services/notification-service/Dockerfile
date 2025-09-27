FROM python:3.12-slim

RUN groupadd -r notify && useradd -r -g notify notify

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY packages/event-schemas ./packages/event-schemas
COPY services/notification-service/pyproject.toml ./pyproject.toml

RUN uv pip install --system -r pyproject.toml

COPY --chown=notify:notify services/notification-service/ ./services/notification-service
WORKDIR /app/services/notification-service

USER notify

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
