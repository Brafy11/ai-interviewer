from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///./interviewer.db"

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


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
