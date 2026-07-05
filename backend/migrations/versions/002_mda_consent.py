"""Add MDA consent columns to patients

Revision ID: 002_mda_consent
Revises: 001_indexes_relationships
Create Date: 2026-07-04

Malawi Data Protection Act 2024 — data-processing consent captured at registration.
Uses ADD COLUMN IF NOT EXISTS so the migration is idempotent against databases
where create_all already added these columns on a previous deploy.
"""
from alembic import op

revision = "002_mda_consent"
down_revision = "001_indexes_relationships"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE patients
            ADD COLUMN IF NOT EXISTS consent_given  BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS consent_date   TIMESTAMP WITH TIME ZONE
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS consent_date")
    op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS consent_given")
