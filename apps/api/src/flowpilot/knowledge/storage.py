from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from flowpilot.persistence.database import Base


class KnowledgeRecord(Base):
    __tablename__ = "knowledge_entries"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_case_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)


class LibraryRevision(Base):
    __tablename__ = "knowledge_library_revision"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
