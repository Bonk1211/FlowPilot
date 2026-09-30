"""Immutable source revisions with reviewed publication and explicit conflicts."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_source_documents",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("source_key", sa.String(), nullable=False, unique=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_table(
        "incident_source_conflicts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("incident_source_conflicts")
    op.drop_table("incident_source_documents")
