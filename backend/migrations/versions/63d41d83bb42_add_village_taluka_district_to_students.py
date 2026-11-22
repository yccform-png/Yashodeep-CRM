"""add_village_taluka_district_to_students

Revision ID: 63d41d83bb42
Revises: d57b2ab2acf8
Create Date: 2026-11-21 21:58:48.007986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63d41d83bb42'
down_revision: Union[str, None] = 'd57b2ab2acf8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch/check if columns already exist (safe idempotent migration)
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS village VARCHAR(150);")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS taluka VARCHAR(100);")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS district VARCHAR(100);")


def downgrade() -> None:
    op.drop_column('students', 'district')
    op.drop_column('students', 'taluka')
    op.drop_column('students', 'village')
