from celery import Celery
import os

# Celery configuration
celery_app = Celery(
    "ai_service",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/1"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/1"),
    include=["tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=120,  # 2 minutes max
    task_soft_time_limit=100,
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=100,  # Restart worker after 100 tasks to free memory
)