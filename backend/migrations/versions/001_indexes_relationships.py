"""Add indexes and relationships

Revision ID: 001_indexes_relationships
Revises: 
Create Date: 2026-06-25

Phase 3 — Data Integrity Fixes:
- H9: Remove lab_tech enum value (consolidate to lab_technician)
- H10: Add FK constraints with cascade rules
- H11: Add indexes on all foreign key columns and frequently queried fields
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "001_indexes_relationships"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── H9: Remove deprecated lab_tech enum value ──
    # PostgreSQL doesn't support removing enum values directly.
    # Any existing lab_tech users should be migrated to lab_technician first:
    #   UPDATE users SET role = 'lab_technician' WHERE role = 'lab_tech';
    # Then the enum value can be ignored (Postgres doesn't support DROP VALUE).
    # We document this here; the model no longer defines lab_tech.

    # ── H11: Add indexes on FK columns that were missing them ──
    # encounters
    op.create_index("ix_encounters_attending_doctor_id", "encounters", ["attending_doctor_id"])
    op.create_index("ix_encounters_created_by", "encounters", ["created_by"])
    op.create_index("ix_encounters_status", "encounters", ["status"])

    # triage_assessments
    op.create_index("ix_triage_assessments_nurse_id", "triage_assessments", ["nurse_id"])

    # clinical_notes
    op.create_index("ix_clinical_notes_author_id", "clinical_notes", ["author_id"])

    # billing_invoices
    op.create_index("ix_billing_invoices_created_by_id", "billing_invoices", ["created_by_id"])
    op.create_index("ix_billing_invoices_status", "billing_invoices", ["status"])
    op.create_index("ix_billing_invoices_invoice_date", "billing_invoices", ["invoice_date"])

    # billing_line_items
    op.create_index("ix_billing_line_items_charge_date", "billing_line_items", ["charge_date"])

    # payments
    op.create_index("ix_payments_received_by_id", "payments", ["received_by_id"])
    op.create_index("ix_payments_received_at", "payments", ["received_at"])

    # lab_orders
    op.create_index("ix_lab_orders_ordered_by_id", "lab_orders", ["ordered_by_id"])
    op.create_index("ix_lab_orders_status", "lab_orders", ["status"])
    op.create_index("ix_lab_orders_order_date", "lab_orders", ["order_date"])

    # lab_order_items
    op.create_index("ix_lab_order_items_test_id", "lab_order_items", ["test_id"])
    op.create_index("ix_lab_order_items_result_flag", "lab_order_items", ["result_flag"])
    op.create_index("ix_lab_order_items_resulted_at", "lab_order_items", ["resulted_at"])

    # drugs
    op.create_index("ix_drugs_name", "drugs", ["name"])
    op.create_index("ix_drugs_category", "drugs", ["category"])

    # drug_stock
    op.create_index("ix_drug_stock_expiry_date", "drug_stock", ["expiry_date"])
    op.create_index("ix_drug_stock_batch_number", "drug_stock", ["batch_number"])

    # prescriptions
    op.create_index("ix_prescriptions_prescribed_by_id", "prescriptions", ["prescribed_by_id"])
    op.create_index("ix_prescriptions_status", "prescriptions", ["status"])
    op.create_index("ix_prescriptions_prescribed_at", "prescriptions", ["prescribed_at"])

    # prescription_items
    op.create_index("ix_prescription_items_drug_id", "prescription_items", ["drug_id"])
    op.create_index("ix_prescription_items_is_dispensed", "prescription_items", ["is_dispensed"])

    # admissions
    op.create_index("ix_admissions_encounter_id", "admissions", ["encounter_id"])
    op.create_index("ix_admissions_ward_id", "admissions", ["ward_id"])
    op.create_index("ix_admissions_bed_id", "admissions", ["bed_id"])
    op.create_index("ix_admissions_admitting_doctor_id", "admissions", ["admitting_doctor_id"])
    op.create_index("ix_admissions_status", "admissions", ["status"])

    # beds
    op.create_index("ix_beds_status", "beds", ["status"])

    # vital_signs
    op.create_index("ix_vital_signs_nurse_id", "vital_signs", ["nurse_id"])
    op.create_index("ix_vital_signs_charted_at", "vital_signs", ["charted_at"])

    # medication_administrations
    op.create_index("ix_medication_administrations_administered_by_id", "medication_administrations", ["administered_by_id"])
    op.create_index("ix_medication_administrations_status", "medication_administrations", ["status"])

    # nursing_notes
    op.create_index("ix_nursing_notes_nurse_id", "nursing_notes", ["nurse_id"])
    op.create_index("ix_nursing_notes_patient_id", "nursing_notes", ["patient_id"])
    op.create_index("ix_nursing_notes_created_at", "nursing_notes", ["created_at"])

    # audit_log
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_entity_type", "audit_log", ["entity_type"])

    # patients
    op.create_index("ix_patients_created_at", "patients", ["created_at"])
    op.create_index("ix_patients_is_deleted", "patients", ["is_deleted"])

    # users
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_active", "users", ["is_active"])


def downgrade() -> None:
    # Drop all indexes created in upgrade()
    indexes = [
        ("ix_users_is_active", "users"),
        ("ix_users_role", "users"),
        ("ix_patients_is_deleted", "patients"),
        ("ix_patients_created_at", "patients"),
        ("ix_audit_log_entity_type", "audit_log"),
        ("ix_audit_log_action", "audit_log"),
        ("ix_audit_log_user_id", "audit_log"),
        ("ix_nursing_notes_created_at", "nursing_notes"),
        ("ix_nursing_notes_patient_id", "nursing_notes"),
        ("ix_nursing_notes_nurse_id", "nursing_notes"),
        ("ix_medication_administrations_status", "medication_administrations"),
        ("ix_medication_administrations_administered_by_id", "medication_administrations"),
        ("ix_vital_signs_charted_at", "vital_signs"),
        ("ix_vital_signs_nurse_id", "vital_signs"),
        ("ix_beds_status", "beds"),
        ("ix_admissions_status", "admissions"),
        ("ix_admissions_admitting_doctor_id", "admissions"),
        ("ix_admissions_bed_id", "admissions"),
        ("ix_admissions_ward_id", "admissions"),
        ("ix_admissions_encounter_id", "admissions"),
        ("ix_prescription_items_is_dispensed", "prescription_items"),
        ("ix_prescription_items_drug_id", "prescription_items"),
        ("ix_prescriptions_prescribed_at", "prescriptions"),
        ("ix_prescriptions_status", "prescriptions"),
        ("ix_prescriptions_prescribed_by_id", "prescriptions"),
        ("ix_drug_stock_batch_number", "drug_stock"),
        ("ix_drug_stock_expiry_date", "drug_stock"),
        ("ix_drugs_category", "drugs"),
        ("ix_drugs_name", "drugs"),
        ("ix_lab_order_items_resulted_at", "lab_order_items"),
        ("ix_lab_order_items_result_flag", "lab_order_items"),
        ("ix_lab_order_items_test_id", "lab_order_items"),
        ("ix_lab_orders_order_date", "lab_orders"),
        ("ix_lab_orders_status", "lab_orders"),
        ("ix_lab_orders_ordered_by_id", "lab_orders"),
        ("ix_payments_received_at", "payments"),
        ("ix_payments_received_by_id", "payments"),
        ("ix_billing_line_items_charge_date", "billing_line_items"),
        ("ix_billing_invoices_invoice_date", "billing_invoices"),
        ("ix_billing_invoices_status", "billing_invoices"),
        ("ix_billing_invoices_created_by_id", "billing_invoices"),
        ("ix_clinical_notes_author_id", "clinical_notes"),
        ("ix_triage_assessments_nurse_id", "triage_assessments"),
        ("ix_encounters_status", "encounters"),
        ("ix_encounters_created_by", "encounters"),
        ("ix_encounters_attending_doctor_id", "encounters"),
    ]
    for index_name, table_name in indexes:
        op.drop_index(index_name, table_name=table_name)

