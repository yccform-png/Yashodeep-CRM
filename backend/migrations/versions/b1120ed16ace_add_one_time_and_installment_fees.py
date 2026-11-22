"""add_one_time_and_installment_fees

Revision ID: b1120ed16ace
Revises: 6ba8b17f5e1d
Create Date: 2026-11-22 09:43:20.739125

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1120ed16ace'
down_revision: Union[str, None] = '6ba8b17f5e1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add dual pricing columns to course_versions
    op.add_column('course_versions', sa.Column('one_time_fee', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('course_versions', sa.Column('installment_fee', sa.Numeric(precision=12, scale=2), nullable=True))
    op.create_check_constraint('check_course_version_one_time_fee', 'course_versions', 'one_time_fee IS NULL OR one_time_fee >= 0')
    op.create_check_constraint('check_course_version_installment_fee', 'course_versions', 'installment_fee IS NULL OR installment_fee >= 0')

    # 2. Add dual pricing columns to subject_groups
    op.add_column('subject_groups', sa.Column('one_time_package_fee', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('subject_groups', sa.Column('installment_package_fee', sa.Numeric(precision=12, scale=2), nullable=True))
    op.create_check_constraint('check_subject_group_one_time_fee', 'subject_groups', 'one_time_package_fee IS NULL OR one_time_package_fee >= 0')
    op.create_check_constraint('check_subject_group_installment_fee', 'subject_groups', 'installment_package_fee IS NULL OR installment_package_fee >= 0')


def downgrade() -> None:
    op.drop_constraint('check_subject_group_installment_fee', 'subject_groups', type_='check')
    op.drop_constraint('check_subject_group_one_time_fee', 'subject_groups', type_='check')
    op.drop_column('subject_groups', 'installment_package_fee')
    op.drop_column('subject_groups', 'one_time_package_fee')

    op.drop_constraint('check_course_version_installment_fee', 'course_versions', type_='check')
    op.drop_constraint('check_course_version_one_time_fee', 'course_versions', type_='check')
    op.drop_column('course_versions', 'installment_fee')
    op.drop_column('course_versions', 'one_time_fee')
