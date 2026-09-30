"""Immutable approved email snapshots and durable send/receipt history."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_communications",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("approval_key", sa.String(), nullable=False, unique=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index(
        "ix_incident_communications_incident_id", "incident_communications", ["incident_id"]
    )


def downgrade():
    op.drop_table("incident_communications")
