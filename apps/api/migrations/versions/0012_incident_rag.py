"""Managed reference index manifest; exact source passages use the existing registry."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_rag_indexes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("payload", sa.JSON(), nullable=False),
    )


def downgrade():
    op.drop_table("incident_rag_indexes")
