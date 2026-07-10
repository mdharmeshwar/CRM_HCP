from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Base(DeclarativeBase):
    pass


def _build_database_url() -> str:
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    if os.getenv("POSTGRES_HOST") and os.getenv("POSTGRES_DB") and os.getenv("POSTGRES_USER"):
        password = os.getenv("POSTGRES_PASSWORD", "")
        port = os.getenv("POSTGRES_PORT", "5432")
        return (
            f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{password}"
            f"@{os.environ['POSTGRES_HOST']}:{port}/{os.environ['POSTGRES_DB']}"
        )

    if os.getenv("MYSQL_HOST") and os.getenv("MYSQL_DATABASE") and os.getenv("MYSQL_USER"):
        password = os.getenv("MYSQL_PASSWORD", "")
        port = os.getenv("MYSQL_PORT", "3306")
        return (
            f"mysql+pymysql://{os.environ['MYSQL_USER']}:{password}"
            f"@{os.environ['MYSQL_HOST']}:{port}/{os.environ['MYSQL_DATABASE']}"
        )

    db_path = Path(__file__).resolve().parent.parent / "crm.sqlite3"
    return f"sqlite:///{db_path.as_posix()}"


DATABASE_URL = _build_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if IS_SQLITE else {},
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
