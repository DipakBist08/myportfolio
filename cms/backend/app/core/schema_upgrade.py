"""Add columns that newer code expects to tables that already exist.

`Base.metadata.create_all` creates missing tables but never alters existing
ones, and this project has no migration tool. The live database (Neon) was
created before these columns existed, so startup adds each one that is missing.
Additive only: nothing is dropped, renamed or rewritten. Works on PostgreSQL
and SQLite, both of which accept ADD COLUMN with a default.
"""
import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# table -> [(column, DDL type and default)]
ADDED_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "posts": [
        ("content_format", "VARCHAR(20) NOT NULL DEFAULT 'html'"),
        ("blog_meta", "TEXT DEFAULT ''"),
    ],
}


def add_missing_columns(engine: Engine) -> list[str]:
    """Add any column in ADDED_COLUMNS that its table lacks. Returns what was added."""
    added: list[str] = []
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    for table, columns in ADDED_COLUMNS.items():
        if table not in tables:
            continue  # create_all makes it complete
        have = {c["name"] for c in inspector.get_columns(table)}
        for name, ddl in columns:
            if name in have:
                continue
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {ddl}'))
            added.append(f"{table}.{name}")
            logger.warning("Added column %s.%s", table, name)
    return added
