"""Add password protection fields to document_versions

Revision ID: a1b2c3d4e5f6
Revises: 7f9d4e3c9a10
Create Date: 2025-01-XX
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "7f9d4e3c9a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password protection columns to document_versions.
    
    Adds:
    - is_password_protected: boolean flag indicating if file is password protected
    - password_hash: bcrypt hash of the password (for verification)
    - encryption_salt: salt used for file encryption (binary data)
    """
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS is_password_protected BOOLEAN DEFAULT FALSE"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS encryption_salt BYTEA"
        )
    )


def downgrade() -> None:
    """Drop password protection columns from document_versions."""
    op.drop_column("document_versions", "encryption_salt")
    op.drop_column("document_versions", "password_hash")
    op.drop_column("document_versions", "is_password_protected")

