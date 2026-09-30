"""Durable normalized-export checkpoints and a bounded original-file buffer."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_gateway_checkpoints",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("offset", sa.Integer(), nullable=False),
        sa.Column("prefix_sha256", sa.String(), nullable=False),
    )
    op.create_table(
        "incident_gateway_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("source_key", sa.String(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("raw_line", sa.LargeBinary(), nullable=False),
        sa.Column("original", sa.LargeBinary(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("detail", sa.String(), nullable=False),
        sa.Column("received_at", sa.String(), nullable=False),
        sa.Column("incident_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_incident_gateway_events_source_key", "incident_gateway_events", ["source_key"]
    )


def downgrade():
    op.drop_table("incident_gateway_events")
    op.drop_table("incident_gateway_checkpoints")
