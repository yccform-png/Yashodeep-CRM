"""add_staff_members_and_expenses

Revision ID: f5c38192a01d
Revises: e4a93c72d1f0
Create Date: 2026-11-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f5c38192a01d'
down_revision: Union[str, None] = 'e4a93c72d1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create staff_members table
    op.create_table(
        'staff_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('institutes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('role_designation', sa.String(length=100), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('base_monthly_salary', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('bank_name', sa.String(length=100), nullable=True),
        sa.Column('bank_account_no', sa.String(length=50), nullable=True),
        sa.Column('bank_ifsc', sa.String(length=20), nullable=True),
        sa.Column('upi_id', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('joining_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index(op.f('ix_staff_members_id'), 'staff_members', ['id'], unique=False)
    op.create_index(op.f('ix_staff_members_institute_id'), 'staff_members', ['institute_id'], unique=False)
    op.create_index(op.f('ix_staff_members_user_id'), 'staff_members', ['user_id'], unique=False)
    op.create_index(op.f('ix_staff_members_name'), 'staff_members', ['name'], unique=False)

    # 2. Create expense_transactions table
    op.create_table(
        'expense_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('institutes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('academic_years.id', ondelete='SET NULL'), nullable=True),
        sa.Column('staff_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff_members.id', ondelete='SET NULL'), nullable=True),
        sa.Column('expense_category', sa.String(length=50), server_default='SALARY', nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('pay_period_month', sa.Integer(), nullable=True),
        sa.Column('pay_period_year', sa.Integer(), nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('payment_mode', sa.String(length=30), server_default='BANK_TRANSFER', nullable=False),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('voucher_number', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='PAID', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.create_index(op.f('ix_expense_transactions_id'), 'expense_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_expense_transactions_institute_id'), 'expense_transactions', ['institute_id'], unique=False)
    op.create_index(op.f('ix_expense_transactions_academic_year_id'), 'expense_transactions', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_expense_transactions_staff_id'), 'expense_transactions', ['staff_id'], unique=False)
    op.create_index(op.f('ix_expense_transactions_voucher_number'), 'expense_transactions', ['voucher_number'], unique=True)


def downgrade() -> None:
    op.drop_table('expense_transactions')
    op.drop_table('staff_members')
