import os
from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

# DATA_DIR defaults to "." (unchanged local-dev behavior: ./interviewer.db).
# The Docker image sets DATA_DIR=/app/data so the DB file lands in a directory
# a reviewer can mount a volume onto (-v ./data:/app/data) to persist it
# across `docker run`s, without mounting over the app code itself.
DATA_DIR = os.environ.get("DATA_DIR", ".")
DATABASE_URL = f"sqlite:///{DATA_DIR}/interviewer.db"

engine = create_engine(
    DATABASE_URL,
    echo=True,  # log SQL statements; flip off when it gets noisy
    # SQLite forbids cross-thread use by default; FastAPI runs sync routes
    # on a threadpool, so that check must be disabled.
    connect_args={"check_same_thread": False},
)


def create_db_and_tables() -> None:
    # Only tables whose module has been imported are registered in
    # SQLModel.metadata — callers must import app.models first.
    SQLModel.metadata.create_all(engine)
    _migrate_existing_tables()


def _migrate_existing_tables() -> None:
    # create_all only creates missing tables; columns added to a table that
    # already exists in the DB file need an explicit ALTER. Ad-hoc checks are
    # enough at this scale — reach for Alembic if these start piling up.
    with engine.connect() as conn:
        for table in ("interviewsession", "report"):
            columns = {
                row[1]
                for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")
            }
            if "created_at" not in columns:
                conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN created_at DATETIME"
                )
                # Rows that predate the column get the migration time — their
                # true creation time is unrecoverable, and the model requires
                # a value.
                conn.exec_driver_sql(
                    f"UPDATE {table} SET created_at = CURRENT_TIMESTAMP"
                )
        conn.commit()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
