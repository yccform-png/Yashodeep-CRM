"""add_crm_profile_and_academic_fields

Revision ID: e4a93c72d1f0
Revises: b1120ed16ace
Create Date: 2026-11-22 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e4a93c72d1f0'
down_revision: Union[str, None] = 'b1120ed16ace'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. institutes columns
    op.add_column('institutes', sa.Column('tagline', sa.String(length=255), nullable=True))
    op.add_column('institutes', sa.Column('registration_number', sa.String(length=100), nullable=True))
    op.add_column('institutes', sa.Column('gstin', sa.String(length=50), nullable=True))
    op.add_column('institutes', sa.Column('secondary_phone', sa.String(length=50), nullable=True))
    op.add_column('institutes', sa.Column('website', sa.String(length=255), nullable=True))
    op.add_column('institutes', sa.Column('signatory_title', sa.String(length=100), nullable=True))
    op.add_column('institutes', sa.Column('bank_name', sa.String(length=100), nullable=True))
    op.add_column('institutes', sa.Column('bank_account_name', sa.String(length=150), nullable=True))
    op.add_column('institutes', sa.Column('bank_account_number', sa.String(length=50), nullable=True))
    op.add_column('institutes', sa.Column('bank_ifsc', sa.String(length=50), nullable=True))
    op.add_column('institutes', sa.Column('bank_branch', sa.String(length=100), nullable=True))
    op.add_column('institutes', sa.Column('upi_id', sa.String(length=100), nullable=True))
    op.add_column('institutes', sa.Column('invoice_terms', sa.Text(), nullable=True))

    # 2. batches columns
    op.add_column('batches', sa.Column('division', sa.String(length=20), server_default='A', nullable=False))

    # 3. courses columns
    op.add_column('courses', sa.Column('is_universal', sa.Boolean(), server_default='false', nullable=False))

    # 4. exam_subjects columns
    op.add_column('exam_subjects', sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_exam_subjects_course_id'), 'exam_subjects', ['course_id'], unique=False)
    op.create_foreign_key('fk_exam_subjects_course_id', 'exam_subjects', 'courses', ['course_id'], ['id'], ondelete='SET NULL')

    # 5. students columns
    op.add_column('students', sa.Column('prn', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_students_prn'), 'students', ['prn'], unique=True)
    op.add_column('students', sa.Column('institution_type', sa.String(length=50), server_default='SCHOOL', nullable=True))
    op.add_column('students', sa.Column('school_college_name', sa.String(length=255), nullable=True))
    op.add_column('students', sa.Column('education_board', sa.String(length=100), nullable=True))
    op.add_column('students', sa.Column('aadhar_number', sa.String(length=20), nullable=True))
    op.add_column('students', sa.Column('category', sa.String(length=50), nullable=True))


def downgrade() -> None:
    # students
    op.drop_column('students', 'category')
    op.drop_column('students', 'aadhar_number')
    op.drop_column('students', 'education_board')
    op.drop_column('students', 'school_college_name')
    op.drop_column('students', 'institution_type')
    op.drop_index(op.f('ix_students_prn'), table_name='students')
    op.drop_column('students', 'prn')

    # exam_subjects
    op.drop_constraint('fk_exam_subjects_course_id', 'exam_subjects', type_='foreignkey')
    op.drop_index(op.f('ix_exam_subjects_course_id'), table_name='exam_subjects')
    op.drop_column('exam_subjects', 'course_id')

    # courses
    op.drop_column('courses', 'is_universal')

    # batches
    op.drop_column('batches', 'division')

    # institutes
    op.drop_column('institutes', 'invoice_terms')
    op.drop_column('institutes', 'upi_id')
    op.drop_column('institutes', 'bank_branch')
    op.drop_column('institutes', 'bank_ifsc')
    op.drop_column('institutes', 'bank_account_number')
    op.drop_column('institutes', 'bank_account_name')
    op.drop_column('institutes', 'bank_name')
    op.drop_column('institutes', 'signatory_title')
    op.drop_column('institutes', 'website')
    op.drop_column('institutes', 'secondary_phone')
    op.drop_column('institutes', 'gstin')
    op.drop_column('institutes', 'registration_number')
    op.drop_column('institutes', 'tagline')
