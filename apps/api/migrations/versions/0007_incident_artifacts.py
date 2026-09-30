"""Preserve bounded original files with raw byte hashes and retention tombstones."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incident_artifacts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("incident_id", sa.String(), nullable=False, index=True),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.UniqueConstraint("incident_id", "sha256"),
    )


def downgrade():
    op.drop_table("incident_artifacts")
