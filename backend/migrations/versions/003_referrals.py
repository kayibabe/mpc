"""Add referrals table

Revision ID: 003_referrals
Revises: 002_mda_consent
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum, UUID as PgUUID

revision = "003_referrals"
down_revision = "002_mda_consent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE referralurgency AS ENUM ('routine', 'urgent', 'emergency');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE referralstatus AS ENUM
                ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    conn = op.get_bind()
    try:
        existing = sa.inspect(conn).get_table_names()
    except Exception:
        existing = []
    if "referrals" not in existing:
        op.create_table(
            "referrals",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("encounter_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("encounters.id"), nullable=False, index=True),
            sa.Column("patient_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("referred_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("destination_facility", sa.String(200), nullable=False),
            sa.Column("destination_department", sa.String(100), nullable=True),
            sa.Column("urgency", PgEnum("routine", "urgent", "emergency",
                                        name="referralurgency", create_type=False),
                      nullable=False, server_default="routine"),
            sa.Column("reason", sa.Text, nullable=False),
            sa.Column("letter_text", sa.Text, nullable=True),
            sa.Column("status", PgEnum("pending", "accepted", "rejected",
                                       "completed", "cancelled",
                                       name="referralstatus", create_type=False),
                      nullable=False, server_default="pending"),
            sa.Column("accepting_provider", sa.String(150), nullable=True),
            sa.Column("feedback_notes", sa.Text, nullable=True),
            sa.Column("feedback_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("referrals")
    op.execute("DROP TYPE IF EXISTS referralstatus")
    op.execute("DROP TYPE IF EXISTS referralurgency")
