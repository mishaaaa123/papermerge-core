"""Add video metadata fields to document_versions

Revision ID: 7f9d4e3c9a10
Revises: 461e410f7eba
Create Date: 2025-12-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f9d4e3c9a10"
down_revision: Union[str, None] = "461e410f7eba"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add optional video metadata columns to document_versions.

    Uses PostgreSQL's IF NOT EXISTS to be resilient if columns
    were created manually before this migration ran.
    """
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS video_duration INTEGER"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS video_width INTEGER"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS video_height INTEGER"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE document_versions "
            "ADD COLUMN IF NOT EXISTS video_codec VARCHAR(255)"
        )
    )


def downgrade() -> None:
    """Drop video metadata columns from document_versions."""
    op.drop_column("document_versions", "video_codec")
    op.drop_column("document_versions", "video_height")
    op.drop_column("document_versions", "video_width")
    op.drop_column("document_versions", "video_duration")
