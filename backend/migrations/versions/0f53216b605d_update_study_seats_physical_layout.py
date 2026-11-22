"""update_study_seats_physical_layout

Revision ID: 0f53216b605d
Revises: 8f1e3a9c72d5
Create Date: 2026-11-21 22:46:34.692493

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f53216b605d'
down_revision: Union[str, None] = '8f1e3a9c72d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Boys Study Hall (B001 - B105)
    # Block 1: R1 (1-16 LTR) & R2 (32 down to 17 RTL)
    for i in range(1, 17):
        seat_num = f"B{i:03d}"
        op.execute(f"UPDATE study_seats SET row_identifier = 'R1', column_identifier = '{i}' WHERE seat_number = '{seat_num}'")
    for i in range(17, 33):
        seat_num = f"B{i:03d}"
        col = 33 - i
        op.execute(f"UPDATE study_seats SET row_identifier = 'R2', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")

    # Block 2: R3 (33-49 LTR) & R4 (66 down to 50 RTL)
    for i in range(33, 50):
        seat_num = f"B{i:03d}"
        col = i - 32
        op.execute(f"UPDATE study_seats SET row_identifier = 'R3', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")
    for i in range(50, 67):
        seat_num = f"B{i:03d}"
        col = 67 - i
        op.execute(f"UPDATE study_seats SET row_identifier = 'R4', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")

    # Block 3: R5 (67-83 LTR) & R6 (100 down to 84 RTL)
    for i in range(67, 84):
        seat_num = f"B{i:03d}"
        col = i - 66
        op.execute(f"UPDATE study_seats SET row_identifier = 'R5', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")
    for i in range(84, 101):
        seat_num = f"B{i:03d}"
        col = 101 - i
        op.execute(f"UPDATE study_seats SET row_identifier = 'R6', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")

    # Block 4: R7 (101-105 LTR)
    for i in range(101, 106):
        seat_num = f"B{i:03d}"
        col = i - 100
        op.execute(f"UPDATE study_seats SET row_identifier = 'R7', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")

    # 2. Girls Study Hall (G001 - G045)
    # Block 1: R1 (1-10 LTR)
    for i in range(1, 11):
        seat_num = f"G{i:03d}"
        op.execute(f"UPDATE study_seats SET row_identifier = 'R1', column_identifier = '{i}' WHERE seat_number = '{seat_num}'")

    # Block 2: R2 (22 down to 11 RTL) & R3 (23-34 LTR)
    for i in range(11, 23):
        seat_num = f"G{i:03d}"
        col = 23 - i
        op.execute(f"UPDATE study_seats SET row_identifier = 'R2', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")
    for i in range(23, 35):
        seat_num = f"G{i:03d}"
        col = i - 22
        op.execute(f"UPDATE study_seats SET row_identifier = 'R3', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")

    # Block 3: R4 (45 down to 35 RTL)
    for i in range(35, 46):
        seat_num = f"G{i:03d}"
        col = 46 - i
        op.execute(f"UPDATE study_seats SET row_identifier = 'R4', column_identifier = '{col}' WHERE seat_number = '{seat_num}'")


def downgrade() -> None:
    pass

