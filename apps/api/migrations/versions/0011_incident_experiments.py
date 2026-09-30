"""Immutable approved mock factorial plans and complete simulated responses."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_experiments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("incident_id", sa.String(), nullable=False),
        sa.Column("proposal_key", sa.String(), nullable=False, unique=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
    )
    op.create_index("ix_incident_experiments_incident_id", "incident_experiments", ["incident_id"])


def downgrade():
    op.drop_table("incident_experiments")
