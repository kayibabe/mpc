"""Add mortuary module tables

Revision ID: 006_mortuary
Revises: 005_theatre
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum, UUID as PgUUID

revision = "006_mortuary"
down_revision = "005_theatre"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE mortuarystatus AS ENUM ('admitted', 'released');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("CREATE SEQUENCE IF NOT EXISTS death_cert_seq START 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS burial_permit_seq START 1")

    conn = op.get_bind()
    try:
        existing = sa.inspect(conn).get_table_names()
    except Exception:
        existing = []

    if "death_records" not in existing:
        op.create_table(
            "death_records",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("patient_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("encounter_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("encounters.id"), nullable=True, index=True),
            sa.Column("admission_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("admissions.id"), nullable=True, index=True),
            sa.Column("date_of_death", sa.DateTime(timezone=True), nullable=False),
            sa.Column("place_of_death", sa.String(150), nullable=True),
            sa.Column("immediate_cause", sa.String(300), nullable=False),
            sa.Column("underlying_cause", sa.String(300), nullable=True),
            sa.Column("contributing_conditions", sa.Text, nullable=True),
            sa.Column("certificate_number", sa.String(30), nullable=False, unique=True),
            sa.Column("certified_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False),
            sa.Column("certified_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    if "mortuary_admissions" not in existing:
        op.create_table(
            "mortuary_admissions",
            sa.Column("id", PgUUID(as_uuid=False), primary_key=True),
            sa.Column("death_record_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("death_records.id"), nullable=False, unique=True),
            sa.Column("tag_number", sa.String(30), nullable=False),
            sa.Column("compartment", sa.String(30), nullable=True),
            sa.Column("received_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=False),
            sa.Column("received_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("status",
                      PgEnum("admitted", "released", name="mortuarystatus", create_type=False),
                      nullable=False, server_default="admitted"),
            sa.Column("family_notified", sa.Boolean, nullable=False,
                      server_default=sa.text("false")),
            sa.Column("notified_person_name", sa.String(150), nullable=True),
            sa.Column("notified_person_relationship", sa.String(50), nullable=True),
            sa.Column("notified_person_phone", sa.String(30), nullable=True),
            sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notified_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True),
            sa.Column("release_permit_number", sa.String(30), nullable=True, unique=True),
            sa.Column("released_to_name", sa.String(150), nullable=True),
            sa.Column("released_to_relationship", sa.String(50), nullable=True),
            sa.Column("released_to_id_number", sa.String(50), nullable=True),
            sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("released_by_id", PgUUID(as_uuid=False),
                      sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("mortuary_admissions")
    op.drop_table("death_records")
    op.execute("DROP TYPE IF EXISTS mortuarystatus")
    op.execute("DROP SEQUENCE IF EXISTS death_cert_seq")
    op.execute("DROP SEQUENCE IF EXISTS burial_permit_seq")
