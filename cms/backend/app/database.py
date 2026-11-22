from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

def _normalise(url: str) -> str:
    # Render and Heroku hand out postgres://...; SQLAlchemy 2 only accepts postgresql://.
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


SQLALCHEMY_DATABASE_URL = _normalise(settings.DATABASE_URL)
IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

# SQLite (local development; on Render's free plan the file is wiped on every
# deploy and restart) or PostgreSQL (a persistent DATABASE_URL, e.g. Neon).
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    pool_pre_ping=not IS_SQLITE,  # hosted PostgreSQL closes idle connections
    echo=settings.DEBUG,
)


if IS_SQLITE:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        # SQLite needs foreign keys switched on per connection.
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


# Schema changes (create_all at startup) go over the direct connection when
# one is given: Neon's pooled URL runs through PgBouncer in transaction mode,
# which Neon advises against for schema work. Otherwise the app's engine.
schema_engine = engine
if not IS_SQLITE and settings.DATABASE_URL_UNPOOLED:
    schema_engine = create_engine(_normalise(settings.DATABASE_URL_UNPOOLED), pool_pre_ping=True,
                                  pool_size=1, max_overflow=0, echo=settings.DEBUG)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
