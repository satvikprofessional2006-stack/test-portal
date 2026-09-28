"""
Local SQLite override — development only.
Import after the main settings to switch the database to SQLite,
so local development doesn't require a running PostgreSQL or Redis server.

Usage:
  DJANGO_SETTINGS_MODULE=config.settings_local python manage.py ...
"""

from .settings import *  # noqa: F401 F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Disable Redis cache for local development
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Execute Celery tasks synchronously in development (no Redis/Celery worker required)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"

# CORS settings for frontend running on localhost:3000
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
