"""add_previous_percentage_to_students

Revision ID: 8f1e3a9c72d5
Revises: 63d41d83bb42
Create Date: 2026-11-21 22:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f1e3a9c72d5'
down_revision: Union[str, None] = '63d41d83bb42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS previous_percentage NUMERIC(5, 2);")


def downgrade() -> None:
    op.drop_column('students', 'previous_percentage')
