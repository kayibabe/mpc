"""Add theatre_cases and preop_checklists tables

Revision ID: 005_theatre
Revises: 004_appointments
Create Date: 2026-07-04

Adds the theatre (surgical/procedure) module: theatre case booking with room
conflict prevention at the application layer, a mandatory pre-op safety
checklist gating the start of the operation, and the full case lifecycle:
booked → pre_op → in_theatre → recovery → completed | cancelled.
"""
from alembic import op
import sqlalchemy as sa

revision = "005_theatre"
down_revision = "004_appointments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE theatrecasestatus AS ENUM
                ('booked', 'pre_op', 'in_theatre', 'recovery', 'completed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    op.create_table(
        "theatre_cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("patient_id", sa.String(36),
                  sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("encounter_id", sa.String(36),
                  sa.ForeignKey("encounters.id"), nullable=False, index=True),
        sa.Column("admission_id", sa.String(36),
                  sa.ForeignKey("admissions.id"), nullable=True, index=True),
        sa.Column("surgeon_id", sa.String(36),
                  sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("anaesthetist_id", sa.String(36),
                  sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("theatre_room", sa.String(50), nullable=False,
                  server_default="Theatre 1"),
        sa.Column("procedure_name", sa.String(200), nullable=False),
        sa.Column("procedure_code", sa.String(20), nullable=True),
        sa.Column("scheduled_start", sa.DateTime(timezone=True),
                  nullable=False, index=True),
        sa.Column("estimated_duration_minutes", sa.Integer,
                  nullable=False, server_default="60"),
        sa.Column("status",
                  sa.Enum("booked", "pre_op", "in_theatre", "recovery",
                          "completed", "cancelled", name="theatrecasestatus", create_type=False),
                  nullable=False, server_default="booked"),
        sa.Column("cancellation_reason", sa.Text, nullable=True),
        sa.Column("operation_notes", sa.Text, nullable=True),
        sa.Column("findings", sa.Text, nullable=True),
        sa.Column("complications", sa.Text, nullable=True),
        sa.Column("operation_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("operation_ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recovery_notes", sa.Text, nullable=True),
        sa.Column("recovery_discharged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.String(36),
                  sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    op.create_table(
        "preop_checklists",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("case_id", sa.String(36),
                  sa.ForeignKey("theatre_cases.id"), nullable=False),
        sa.Column("consent_signed", sa.Boolean, nullable=False),
        sa.Column("fasting_confirmed", sa.Boolean, nullable=False),
        sa.Column("site_marked", sa.Boolean, nullable=False),
        sa.Column("anaesthesia_review_done", sa.Boolean, nullable=False),
        sa.Column("bloods_available", sa.Boolean, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("completed_by_id", sa.String(36),
                  sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint("case_id", name="uq_preop_checklists_case_id"),
    )


def downgrade() -> None:
    op.drop_table("preop_checklists")
    op.drop_table("theatre_cases")
    op.execute("DROP TYPE IF EXISTS theatrecasestatus")
