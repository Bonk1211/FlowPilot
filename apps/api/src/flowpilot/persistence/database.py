from sqlalchemy import JSON, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from flowpilot.settings import Settings


class Base(DeclarativeBase):
    pass


class InvestigationSnapshot(Base):
    __tablename__ = "investigation_snapshots"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    schema_version: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


def make_engine(url: str | None = None):
    return create_engine(url or Settings().database_url)
