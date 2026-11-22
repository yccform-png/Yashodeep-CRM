"""add_form_fee_trial_days_and_restructuring

Revision ID: 6ba8b17f5e1d
Revises: 0f53216b605d
Create Date: 2026-11-21 23:23:02.677682

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ba8b17f5e1d'
down_revision: Union[str, None] = '0f53216b605d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


"""add_form_fee_trial_days_and_restructuring

Revision ID: 6ba8b17f5e1d
Revises: 0f53216b605d
Create Date: 2026-11-21 23:23:02.677682

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '6ba8b17f5e1d'
down_revision: Union[str, None] = '0f53216b605d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. institutes table alterations
    op.add_column('institutes', sa.Column('admission_form_fee', sa.Numeric(10, 2), server_default='200.00', nullable=False))
    op.add_column('institutes', sa.Column('trial_period_days', sa.Integer(), server_default='14', nullable=False))
    op.add_column('institutes', sa.Column('grace_period_days', sa.Integer(), server_default='7', nullable=False))
    op.add_column('institutes', sa.Column('enable_admission_form_fee', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('institutes', sa.Column('enable_trial_admission', sa.Boolean(), server_default='true', nullable=False))

    # 2. students table alterations
    op.add_column('students', sa.Column('trial_end_date', sa.Date(), nullable=True))
    op.add_column('students', sa.Column('trial_form_fee_paid', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('students', sa.Column('trial_receipt_number', sa.String(50), nullable=True))

    op.execute("ALTER TABLE students DROP CONSTRAINT IF EXISTS check_student_status")
    op.execute("""
        ALTER TABLE students ADD CONSTRAINT check_student_status 
        CHECK (status IN ('ACTIVE', 'PROVISIONAL_TRIAL', 'TRIAL_DROPOUT', 'INACTIVE', 'PROMOTED', 'WITHDRAWN', 'GRADUATED', 'SUSPENDED'))
    """)

    # 3. enrollments table alterations
    op.execute("ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS check_enrollment_status")
    op.execute("""
        ALTER TABLE enrollments ADD CONSTRAINT check_enrollment_status 
        CHECK (status IN ('ACTIVE', 'PROVISIONAL_TRIAL', 'TRIAL_DROPOUT', 'PROMOTED', 'COMPLETED', 'WITHDRAWN', 'CANCELLED', 'SUSPENDED'))
    """)

    # 4. installment_plans table alterations
    op.add_column('installment_plans', sa.Column('is_restructured', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('installment_plans', sa.Column('restructure_reason', sa.Text(), nullable=True))
    op.add_column('installment_plans', sa.Column('restructured_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('installment_plans', sa.Column('restructured_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('installment_plans', 'restructured_by_user_id')
    op.drop_column('installment_plans', 'restructured_at')
    op.drop_column('installment_plans', 'restructure_reason')
    op.drop_column('installment_plans', 'is_restructured')

    op.drop_column('students', 'trial_receipt_number')
    op.drop_column('students', 'trial_form_fee_paid')
    op.drop_column('students', 'trial_end_date')

    op.drop_column('institutes', 'enable_trial_admission')
    op.drop_column('institutes', 'enable_admission_form_fee')
    op.drop_column('institutes', 'grace_period_days')
    op.drop_column('institutes', 'trial_period_days')
    op.drop_column('institutes', 'admission_form_fee')

