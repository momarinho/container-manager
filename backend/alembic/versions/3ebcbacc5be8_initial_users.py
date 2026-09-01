"""initial_users

Revision ID: 3ebcbacc5be8
Revises:
Create Date: 2026-09-01 09:30:14.860754

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3ebcbacc5be8"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_users_username"), "users", ["username"], unique=True, if_not_exists=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_users_username"), table_name="users", if_exists=True)
    op.drop_table("users", if_exists=True)
