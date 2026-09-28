"""
Local SQLite override — development only.
Import after the main settings to switch the database to SQLite,
so local development doesn't require a running PostgreSQL server.

Usage:
  DJANGO_SETTINGS_MODULE=config.settings_local python manage.py ...
"""

from .settings import *  # noqa: F401 F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Disable Redis cache for local runs too
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
