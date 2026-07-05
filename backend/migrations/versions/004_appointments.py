"""Add appointments table

Revision ID: 004_appointments
Revises: 003_referrals
Create Date: 2026-07-04

Adds the appointments table for pre-booking patient visits with a provider,
supporting the full lifecycle: scheduled → confirmed → arrived → in_progress
→ completed | cancelled | no_show. Check-in links the appointment to an
encounter. Double-booking is prevented at the application layer.
"""
from alembic import op
import sqlalchemy as sa

revision = "004_appointments"
down_revision = "003_referrals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE appointmenttype AS ENUM
                ('opd', 'follow_up', 'procedure', 'antenatal', 'immunization', 'other');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE appointmentstatus AS ENUM
                ('scheduled', 'confirmed', 'arrived', 'in_progress',
                 'completed', 'cancelled', 'no_show');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    conn = op.get_bind()
    existing = sa.inspect(conn).get_table_names()
    if "appointments" not in existing:
        op.create_table(
            "appointments",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("patient_id", sa.String(36),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("provider_id", sa.String(36),
                      sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("scheduled_datetime", sa.DateTime(timezone=True),
                      nullable=False, index=True),
            sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="15"),
            sa.Column("appointment_type",
                      sa.Enum("opd", "follow_up", "procedure", "antenatal",
                              "immunization", "other", name="appointmenttype", create_type=False),
                      nullable=False, server_default="opd"),
            sa.Column("visit_reason", sa.Text, nullable=True),
            sa.Column("status",
                      sa.Enum("scheduled", "confirmed", "arrived", "in_progress",
                              "completed", "cancelled", "no_show",
                              name="appointmentstatus", create_type=False),
                      nullable=False, server_default="scheduled"),
            sa.Column("cancellation_reason", sa.Text, nullable=True),
            sa.Column("encounter_id", sa.String(36),
                      sa.ForeignKey("encounters.id"), nullable=True, index=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_by_id", sa.String(36),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("appointments")
    op.execute("DROP TYPE IF EXISTS appointmentstatus")
    op.execute("DROP TYPE IF EXISTS appointmenttype")
