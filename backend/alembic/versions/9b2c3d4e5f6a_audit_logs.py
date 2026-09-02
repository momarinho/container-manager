"""audit_logs

Revision ID: 9b2c3d4e5f6a
Revises: 7a1f4b8c9d0e
Create Date: 2026-09-02 09:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9b2c3d4e5f6a"
down_revision: str | Sequence[str] | None = "7a1f4b8c9d0e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("resource_type", sa.String(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column("client_ip", sa.String(), nullable=False, server_default="unknown"),
        sa.Column("details", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(), nullable=False, server_default="SUCCESS"),
        sa.Column("timestamp", sa.String(), nullable=False),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_user_id"),
        "audit_logs",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_username"),
        "audit_logs",
        ["username"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_action"),
        "audit_logs",
        ["action"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_resource_type"),
        "audit_logs",
        ["resource_type"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_resource_id"),
        "audit_logs",
        ["resource_id"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_audit_logs_timestamp"),
        "audit_logs",
        ["timestamp"],
        if_not_exists=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_audit_logs_timestamp"), table_name="audit_logs", if_exists=True)
    op.drop_index(op.f("ix_audit_logs_resource_id"), table_name="audit_logs", if_exists=True)
    op.drop_index(op.f("ix_audit_logs_resource_type"), table_name="audit_logs", if_exists=True)
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs", if_exists=True)
    op.drop_index(op.f("ix_audit_logs_username"), table_name="audit_logs", if_exists=True)
    op.drop_index(op.f("ix_audit_logs_user_id"), table_name="audit_logs", if_exists=True)
    op.drop_table("audit_logs", if_exists=True)
