"""Audit configured incident access without recording credentials or evidence content."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_access_audit",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("timestamp", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=True),
        sa.Column("method", sa.String(), nullable=False),
        sa.Column("resource", sa.String(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("incident_access_audit")
