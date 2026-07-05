"""Add insurance/medical-scheme tables

Revision ID: 007_insurance
Revises: 006_mortuary
Create Date: 2026-07-04

Adds insurers (insurance companies and medical schemes), scheme_members
(member cards with validity windows for front-desk verification),
pre_authorizations (approval before high-cost services), and
insurance_claims (invoice-linked claims with co-payment split and
submitted → approved/partially_approved/rejected → settled lifecycle).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum

revision = "007_insurance"
down_revision = "006_mortuary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE payertype AS ENUM ('insurance', 'medical_scheme');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE memberstatus AS ENUM ('active', 'suspended', 'expired');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE preauthstatus AS ENUM ('requested', 'approved', 'rejected');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        DO $$ BEGIN
            CREATE TYPE claimstatus AS ENUM
                ('draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'settled');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("CREATE SEQUENCE IF NOT EXISTS claim_seq START 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS preauth_seq START 1")

    conn = op.get_bind()
    existing = sa.inspect(conn).get_table_names()

    if "insurers" not in existing:
        op.create_table(
            "insurers",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(150), nullable=False, unique=True),
            sa.Column("payer_type",
                      PgEnum("insurance", "medical_scheme", name="payertype", create_type=False),
                      nullable=False),
            sa.Column("contact_person", sa.String(150), nullable=True),
            sa.Column("phone", sa.String(30), nullable=True),
            sa.Column("email", sa.String(150), nullable=True),
            sa.Column("address", sa.Text, nullable=True),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    if "scheme_members" not in existing:
        op.create_table(
            "scheme_members",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("insurer_id", sa.String(36),
                      sa.ForeignKey("insurers.id"), nullable=False, index=True),
            sa.Column("patient_id", sa.String(36),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("member_number", sa.String(50), nullable=False),
            sa.Column("plan_name", sa.String(100), nullable=True),
            sa.Column("valid_from", sa.Date, nullable=False),
            sa.Column("valid_to", sa.Date, nullable=True),
            sa.Column("status",
                      PgEnum("active", "suspended", "expired", name="memberstatus", create_type=False),
                      nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.UniqueConstraint("insurer_id", "member_number", name="uq_member_per_insurer"),
        )

    if "pre_authorizations" not in existing:
        op.create_table(
            "pre_authorizations",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("auth_number", sa.String(30), nullable=True, unique=True),
            sa.Column("insurer_id", sa.String(36),
                      sa.ForeignKey("insurers.id"), nullable=False, index=True),
            sa.Column("patient_id", sa.String(36),
                      sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("member_id", sa.String(36),
                      sa.ForeignKey("scheme_members.id"), nullable=True, index=True),
            sa.Column("service_description", sa.Text, nullable=False),
            sa.Column("estimated_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("status",
                      PgEnum("requested", "approved", "rejected", name="preauthstatus", create_type=False),
                      nullable=False, server_default="requested"),
            sa.Column("decision_notes", sa.Text, nullable=True),
            sa.Column("requested_by_id", sa.String(36),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    if "insurance_claims" not in existing:
        op.create_table(
            "insurance_claims",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("claim_number", sa.String(30), nullable=False, unique=True),
            sa.Column("invoice_id", sa.String(36),
                      sa.ForeignKey("billing_invoices.id"), nullable=False, index=True),
            sa.Column("insurer_id", sa.String(36),
                      sa.ForeignKey("insurers.id"), nullable=False, index=True),
            sa.Column("member_id", sa.String(36),
                      sa.ForeignKey("scheme_members.id"), nullable=True, index=True),
            sa.Column("preauth_id", sa.String(36),
                      sa.ForeignKey("pre_authorizations.id"), nullable=True, index=True),
            sa.Column("claimed_amount", sa.Numeric(12, 2), nullable=False),
            sa.Column("copay_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("approved_amount", sa.Numeric(12, 2), nullable=True),
            sa.Column("status",
                      PgEnum("draft", "submitted", "approved", "partially_approved",
                             "rejected", "settled", name="claimstatus", create_type=False),
                      nullable=False, server_default="draft"),
            sa.Column("rejection_reason", sa.Text, nullable=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_id", sa.String(36),
                      sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("insurance_claims")
    op.drop_table("pre_authorizations")
    op.drop_table("scheme_members")
    op.drop_table("insurers")
    op.execute("DROP SEQUENCE IF EXISTS claim_seq")
    op.execute("DROP SEQUENCE IF EXISTS preauth_seq")
    op.execute("DROP TYPE IF EXISTS claimstatus")
    op.execute("DROP TYPE IF EXISTS preauthstatus")
    op.execute("DROP TYPE IF EXISTS memberstatus")
    op.execute("DROP TYPE IF EXISTS payertype")
