"""Reviewed case experience without rewriting existing case payloads."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "knowledge_entries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("source_case_id", sa.String(), nullable=False, unique=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_knowledge_entries_status", "knowledge_entries", ["status"])
    table = op.create_table(
        "knowledge_library_revision",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
    )
    op.bulk_insert(table, [{"id": 1, "revision": 0}])


def downgrade():
    op.drop_table("knowledge_entries")
    op.drop_table("knowledge_library_revision")
