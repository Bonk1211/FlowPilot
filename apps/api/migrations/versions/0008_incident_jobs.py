"""Durable independent incident jobs."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_jobs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("input_fingerprint", sa.String(), nullable=False),
        sa.Column("source_revision", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
        sa.Column("lease_until", sa.String()),
        sa.Column("worker_token", sa.String()),
        sa.Column("error", sa.String()),
        sa.UniqueConstraint("incident_id", "input_fingerprint", "kind"),
    )
    op.create_index("ix_incident_jobs_incident_id", "incident_jobs", ["incident_id"])
    op.create_index("ix_incident_jobs_state", "incident_jobs", ["state"])


def downgrade():
    op.drop_table("incident_jobs")
