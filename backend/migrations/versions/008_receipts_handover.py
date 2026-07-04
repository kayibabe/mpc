"""Payment receipt numbers and nursing handover note type

Revision ID: 008_receipts_handover
Revises: 007_insurance
Create Date: 2026-07-04

Adds payments.receipt_number (RCT000001, backed by rct_seq) so every payment
produces a printable receipt, and nursing_notes.note_type ('routine' |
'handover') so end-of-shift handover notes are queryable separately from
routine progress notes.
"""
from alembic import op
import sqlalchemy as sa

revision = "008_receipts_handover"
down_revision = "007_insurance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS rct_seq START 1")
    op.add_column("payments", sa.Column("receipt_number", sa.String(30), nullable=True))
    op.create_unique_constraint("uq_payments_receipt_number", "payments", ["receipt_number"])
    op.add_column(
        "nursing_notes",
        sa.Column("note_type", sa.String(20), nullable=False, server_default="routine"),
    )


def downgrade() -> None:
    op.drop_column("nursing_notes", "note_type")
    op.drop_constraint("uq_payments_receipt_number", "payments", type_="unique")
    op.drop_column("payments", "receipt_number")
    op.execute("DROP SEQUENCE IF EXISTS rct_seq")
