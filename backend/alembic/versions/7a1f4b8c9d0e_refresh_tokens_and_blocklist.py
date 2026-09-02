"""refresh_tokens_and_blocklist

Revision ID: 7a1f4b8c9d0e
Revises: 3ebcbacc5be8
Create Date: 2026-09-02 08:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a1f4b8c9d0e"
down_revision: str | Sequence[str] | None = "3ebcbacc5be8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("family_id", sa.String(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_refresh_tokens_user_id"),
        "refresh_tokens",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_refresh_tokens_token_hash"),
        "refresh_tokens",
        ["token_hash"],
        unique=True,
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"),
        "refresh_tokens",
        ["family_id"],
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_refresh_tokens_expires_at"),
        "refresh_tokens",
        ["expires_at"],
        if_not_exists=True,
    )

    op.create_table(
        "token_blocklist",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("jti", sa.String(), nullable=False),
        sa.Column("token_type", sa.String(), nullable=False, server_default="access"),
        sa.Column("revoked_at", sa.String(), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_token_blocklist_jti"),
        "token_blocklist",
        ["jti"],
        unique=True,
        if_not_exists=True,
    )
    op.create_index(
        op.f("ix_token_blocklist_expires_at"),
        "token_blocklist",
        ["expires_at"],
        if_not_exists=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_token_blocklist_expires_at"), table_name="token_blocklist", if_exists=True
    )
    op.drop_index(op.f("ix_token_blocklist_jti"), table_name="token_blocklist", if_exists=True)
    op.drop_table("token_blocklist", if_exists=True)

    op.drop_index(op.f("ix_refresh_tokens_expires_at"), table_name="refresh_tokens", if_exists=True)
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens", if_exists=True)
    op.drop_index(op.f("ix_refresh_tokens_token_hash"), table_name="refresh_tokens", if_exists=True)
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens", if_exists=True)
    op.drop_table("refresh_tokens", if_exists=True)
