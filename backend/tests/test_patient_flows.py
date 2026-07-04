"""End-to-end patient-flow smoke tests — one test per handover scenario.

Each test drives the full request chain through the real API (no mocking):
registration → clinical activity → billing, exactly as the production
handover audit specifies. Tests share one in-memory database (see conftest),
so every test uses unique names/phones and tolerant (>=, membership)
assertions on aggregate endpoints.
"""
import pytest
from datetime import datetime, timedelta, timezone, date

from app.models.user import UserRole


def _hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _register_patient(client, headers, first_name, last_name, phone, **overrides):
    body = {
        "first_name": first_name,
        "last_name": last_name,
        "gender": "male",
        "date_of_birth": "1985-03-12",
        "phone": phone,
        "consent_given": True,
        **overrides,
    }
    resp = await client.post("/api/v1/patients", json=body, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _make_ward_and_bed(client, admin_headers, ward_name, bed_number):
    ward = await client.post(
        "/api/v1/admissions/wards",
        json={"name": ward_name, "ward_type": "general", "total_beds": 4, "charge_per_day": 5000},
        headers=admin_headers,
    )
    assert ward.status_code == 201, ward.text
    ward_id = ward.json()["id"]
    bed = await client.post(
        f"/api/v1/admissions/wards/{ward_id}/beds",
        json={"bed_number": bed_number},
        headers=admin_headers,
    )
    assert bed.status_code == 201, bed.text
    return ward_id, bed.json()["id"]


async def _make_drug_with_stock(client, pharm_headers, name, quantity):
    drug = await client.post(
        "/api/v1/pharmacy/drugs",
        json={"name": name, "form": "tablet", "unit_price": 150.0},
        headers=pharm_headers,
    )
    assert drug.status_code == 201, drug.text
    drug_id = drug.json()["id"]
    stock = await client.post(
        f"/api/v1/pharmacy/drugs/{drug_id}/stock",
        json={
            "batch_number": f"B-{name[:8]}",
            "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
            "quantity_received": quantity,
            "received_date": date.today().isoformat(),
        },
        headers=pharm_headers,
    )
    assert stock.status_code == 201, stock.text
    return drug_id


# ── Scenario 1: Walk-in OPD ───────────────────────────────────────────────────

async def test_s01_walkin_opd_full_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    nurse_token, _ = await auth_token(UserRole.nurse)
    doc_token, doc = await auth_token(UserRole.doctor)
    pharm_token, _ = await auth_token(UserRole.pharmacist)
    bill_token, _ = await auth_token(UserRole.billing_clerk)
    cash_token, _ = await auth_token(UserRole.cashier)

    patient = await _register_patient(client, _hdr(rec_token), "Chikondi", "Flowone", "0991000001")

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd",
              "attending_doctor_id": doc.id, "chief_complaint": "Fever and headache"},
        headers=_hdr(nurse_token),
    )
    assert enc.status_code == 201, enc.text
    enc_id = enc.json()["id"]

    triage = await client.post(
        f"/api/v1/encounters/{enc_id}/triage",
        json={"triage_category": "urgent", "bp_systolic": 128, "bp_diastolic": 84,
              "pulse": 96, "temperature": 38.6, "spo2": 97},
        headers=_hdr(nurse_token),
    )
    assert triage.status_code == 201, triage.text

    note = await client.post(
        f"/api/v1/encounters/{enc_id}/notes",
        json={"subjective": "3 days fever", "objective": "Temp 38.6, RDT positive",
              "assessment": "Uncomplicated malaria", "plan": "AL 6 doses",
              "diagnoses": [{"code": "B54", "label": "Malaria, unspecified"}]},
        headers=_hdr(doc_token),
    )
    assert note.status_code == 201, note.text

    drug_id = await _make_drug_with_stock(client, _hdr(pharm_token), "AL-Flow1", 50)
    rx = await client.post(
        "/api/v1/pharmacy/prescriptions",
        json={"encounter_id": enc_id, "patient_id": patient["id"],
              "items": [{"drug_id": drug_id, "dose": "80/480mg", "frequency": "BD",
                         "quantity": 6}]},
        headers=_hdr(doc_token),
    )
    assert rx.status_code == 201, rx.text
    rx_id = rx.json()["id"]
    rx_item_id = rx.json()["items"][0]["id"]

    dispense = await client.post(
        f"/api/v1/pharmacy/prescriptions/{rx_id}/dispense",
        json={"items": [{"prescription_item_id": rx_item_id, "quantity_dispensed": 6}]},
        headers=_hdr(pharm_token),
    )
    assert dispense.status_code == 200, dispense.text
    assert dispense.json()["status"] == "dispensed"

    invoice = await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "line_items": [
                  {"item_type": "consultation", "description": "OPD consult", "quantity": 1, "unit_price": 2000},
                  {"item_type": "drug", "description": "AL x6", "quantity": 6, "unit_price": 150},
              ]},
        headers=_hdr(bill_token),
    )
    assert invoice.status_code == 201, invoice.text
    inv = invoice.json()
    assert inv["total"] == 2900.0

    pay = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 2900.0, "payment_mode": "cash"},
        headers=_hdr(cash_token),
    )
    assert pay.status_code == 201, pay.text
    assert pay.json()["receipt_number"].startswith("RCT")

    paid = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(cash_token))
    assert paid.json()["status"] == "paid"
    assert paid.json()["balance"] == 0.0

    close = await client.put(
        f"/api/v1/encounters/{enc_id}", json={"status": "closed"}, headers=_hdr(doc_token)
    )
    assert close.status_code == 200
    assert close.json()["status"] == "closed"


# ── Scenario 2: Emergency intake ──────────────────────────────────────────────

async def test_s02_emergency_intake(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    nurse_token, _ = await auth_token(UserRole.nurse)
    doc_token, _ = await auth_token(UserRole.doctor)

    # Rapid registration: minimal demographics only
    patient = await _register_patient(
        client, _hdr(rec_token), "Unknown", "Flowtwo", "0991000002", date_of_birth=None
    )

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "emergency",
              "chief_complaint": "RTA, unresponsive"},
        headers=_hdr(nurse_token),
    )
    assert enc.status_code == 201, enc.text
    enc_id = enc.json()["id"]
    assert enc.json()["encounter_type"] == "emergency"

    # Initial triage by nurse …
    t1 = await client.post(
        f"/api/v1/encounters/{enc_id}/triage",
        json={"triage_category": "urgent", "bp_systolic": 90, "bp_diastolic": 60, "spo2": 91},
        headers=_hdr(nurse_token),
    )
    assert t1.status_code == 201, t1.text

    # … overridden to immediate by the doctor (upsert on the same encounter)
    t2 = await client.post(
        f"/api/v1/encounters/{enc_id}/triage",
        json={"triage_category": "immediate", "bp_systolic": 80, "bp_diastolic": 50, "spo2": 88},
        headers=_hdr(doc_token),
    )
    assert t2.status_code == 201, t2.text
    assert t2.json()["triage_category"] == "immediate"

    # Emergency consult + stabilisation notes
    consult = await client.post(
        f"/api/v1/encounters/{enc_id}/notes",
        json={"subjective": "Unresponsive post-RTA", "objective": "GCS 9, BP 80/50",
              "assessment": "Hypovolaemic shock", "plan": "2L IV fluids, cross-match"},
        headers=_hdr(doc_token),
    )
    assert consult.status_code == 201, consult.text
    stab = await client.post(
        f"/api/v1/encounters/{enc_id}/notes",
        json={"objective": "Post 2L: BP 104/68, GCS 13",
              "plan": "Stabilised; admit for observation"},
        headers=_hdr(doc_token),
    )
    assert stab.status_code == 201, stab.text

    detail = await client.get(f"/api/v1/encounters/{enc_id}", headers=_hdr(doc_token))
    assert detail.json()["triage"]["triage_category"] == "immediate"
    assert len(detail.json()["notes"]) == 2


# ── Scenario 3: Inpatient admission ──────────────────────────────────────────

async def test_s03_inpatient_admission(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    nurse_token, _ = await auth_token(UserRole.nurse)
    doc_token, _ = await auth_token(UserRole.doctor)
    admin_token, _ = await auth_token(UserRole.admin)
    lab_token, _ = await auth_token(UserRole.lab_technician)

    patient = await _register_patient(client, _hdr(rec_token), "Mary", "Flowthree", "0991000003")
    ward_id, bed_id = await _make_ward_and_bed(client, _hdr(admin_token), "Male Ward F3", "F3-1")

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "ipd",
              "chief_complaint": "Severe pneumonia"},
        headers=_hdr(doc_token),
    )
    enc_id = enc.json()["id"]

    adm = await client.post(
        "/api/v1/admissions",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "ward_id": ward_id, "bed_id": bed_id},
        headers=_hdr(doc_token),
    )
    assert adm.status_code == 201, adm.text
    adm_id = adm.json()["id"]

    # Ward round note (clinical note on the encounter)
    round_note = await client.post(
        f"/api/v1/encounters/{enc_id}/notes",
        json={"subjective": "Day 2, less dyspnoeic", "objective": "SpO2 94% on air",
              "assessment": "Improving pneumonia", "plan": "Continue IV antibiotics"},
        headers=_hdr(doc_token),
    )
    assert round_note.status_code == 201, round_note.text

    # Investigation order + result
    test = await client.post(
        "/api/v1/lab/tests",
        json={"name": "FBC F3", "code": "FBC-F3", "category": "Haematology",
              "sample_type": "blood", "price": 1500},
        headers=_hdr(admin_token),
    )
    assert test.status_code == 201, test.text
    order = await client.post(
        "/api/v1/lab/orders",
        json={"encounter_id": enc_id, "patient_id": patient["id"], "priority": "urgent",
              "items": [{"test_id": test.json()["id"]}]},
        headers=_hdr(doc_token),
    )
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]
    item_id = order.json()["items"][0]["id"]

    st = await client.put(
        f"/api/v1/lab/orders/{order_id}/status", json={"status": "processing"}, headers=_hdr(lab_token)
    )
    assert st.status_code == 200, st.text
    result = await client.post(
        f"/api/v1/lab/orders/{order_id}/results/{item_id}",
        json={"result_value": "11.2", "result_unit": "g/dL", "result_flag": "normal"},
        headers=_hdr(lab_token),
    )
    assert result.status_code == 200, result.text
    assert result.json()["result_value"] == "11.2"

    # Nursing vitals + routine note + shift handover note
    vitals = await client.post(
        "/api/v1/nursing/vitals",
        json={"admission_id": adm_id, "patient_id": patient["id"],
              "bp_systolic": 118, "bp_diastolic": 76, "pulse": 82, "temperature": 37.1},
        headers=_hdr(nurse_token),
    )
    assert vitals.status_code == 201, vitals.text

    routine = await client.post(
        "/api/v1/nursing/notes",
        json={"admission_id": adm_id, "patient_id": patient["id"], "shift": "day",
              "note_type": "routine", "note_text": "Comfortable, tolerating oral fluids"},
        headers=_hdr(nurse_token),
    )
    assert routine.status_code == 201, routine.text

    handover = await client.post(
        "/api/v1/nursing/notes",
        json={"admission_id": adm_id, "patient_id": patient["id"], "shift": "night",
              "note_type": "handover",
              "note_text": "Handover to night shift: obs 4-hourly, IV abx due 22:00"},
        headers=_hdr(nurse_token),
    )
    assert handover.status_code == 201, handover.text
    assert handover.json()["note_type"] == "handover"

    ho_list = await client.get(
        f"/api/v1/nursing/notes?admission_id={adm_id}&note_type=handover",
        headers=_hdr(nurse_token),
    )
    assert ho_list.status_code == 200
    assert len(ho_list.json()) == 1
    assert ho_list.json()[0]["note_type"] == "handover"

    # No invoices on this admission — discharge clears immediately
    dis = await client.post(
        f"/api/v1/admissions/{adm_id}/discharge",
        json={"discharge_type": "normal", "discharge_summary": "Completed IV course"},
        headers=_hdr(doc_token),
    )
    assert dis.status_code == 200, dis.text


# ── Scenario 4: Surgical / procedure flow ─────────────────────────────────────

async def test_s04_surgical_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    nurse_token, _ = await auth_token(UserRole.nurse)
    doc_token, doc = await auth_token(UserRole.doctor)
    admin_token, _ = await auth_token(UserRole.admin)

    patient = await _register_patient(client, _hdr(rec_token), "Grace", "Flowfour", "0991000004")
    ward_id, bed_id = await _make_ward_and_bed(client, _hdr(admin_token), "Surgical Ward F4", "F4-1")

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "ipd",
              "chief_complaint": "Acute appendicitis"},
        headers=_hdr(doc_token),
    )
    enc_id = enc.json()["id"]
    adm = await client.post(
        "/api/v1/admissions",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "ward_id": ward_id, "bed_id": bed_id},
        headers=_hdr(doc_token),
    )
    adm_id = adm.json()["id"]

    start_at = (datetime.now(timezone.utc) + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    )
    case = await client.post(
        "/api/v1/theatre/cases",
        json={"patient_id": patient["id"], "encounter_id": enc_id, "admission_id": adm_id,
              "surgeon_id": doc.id, "theatre_room": "Theatre 2",
              "procedure_name": "Open appendicectomy",
              "scheduled_start": start_at.isoformat(), "estimated_duration_minutes": 90},
        headers=_hdr(doc_token),
    )
    assert case.status_code == 201, case.text
    case_id = case.json()["id"]
    assert case.json()["status"] == "booked"

    checklist = await client.post(
        f"/api/v1/theatre/cases/{case_id}/preop-checklist",
        json={"consent_signed": True, "fasting_confirmed": True, "site_marked": True,
              "anaesthesia_review_done": True, "bloods_available": True},
        headers=_hdr(nurse_token),
    )
    assert checklist.status_code == 201, checklist.text

    started = await client.post(f"/api/v1/theatre/cases/{case_id}/start", headers=_hdr(doc_token))
    assert started.status_code == 200, started.text
    assert started.json()["status"] == "in_theatre"

    postop = await client.post(
        f"/api/v1/theatre/cases/{case_id}/post-op",
        json={"operation_notes": "Inflamed appendix removed; washout done",
              "findings": "Perforated tip, localised pus", "complications": None},
        headers=_hdr(doc_token),
    )
    assert postop.status_code == 200, postop.text
    assert postop.json()["status"] == "recovery"

    done = await client.post(
        f"/api/v1/theatre/cases/{case_id}/complete",
        json={"recovery_notes": "Obs stable in recovery for 2h; back to ward"},
        headers=_hdr(nurse_token),
    )
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"
    assert done.json()["operation_started_at"] is not None
    assert done.json()["recovery_discharged_at"] is not None


# ── Scenario 5: Discharge with billing clearance ─────────────────────────────

async def test_s05_discharge_billing_clearance(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    doc_token, _ = await auth_token(UserRole.doctor)
    admin_token, _ = await auth_token(UserRole.admin)
    pharm_token, _ = await auth_token(UserRole.pharmacist)
    bill_token, _ = await auth_token(UserRole.billing_clerk)
    cash_token, _ = await auth_token(UserRole.cashier)

    patient = await _register_patient(client, _hdr(rec_token), "John", "Flowfive", "0991000005")
    ward_id, bed_id = await _make_ward_and_bed(client, _hdr(admin_token), "Ward F5", "F5-1")

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "ipd"},
        headers=_hdr(doc_token),
    )
    enc_id = enc.json()["id"]
    adm = await client.post(
        "/api/v1/admissions",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "ward_id": ward_id, "bed_id": bed_id},
        headers=_hdr(doc_token),
    )
    adm_id = adm.json()["id"]

    # Medication on discharge
    drug_id = await _make_drug_with_stock(client, _hdr(pharm_token), "Amox-F5", 30)
    rx = await client.post(
        "/api/v1/pharmacy/prescriptions",
        json={"encounter_id": enc_id, "patient_id": patient["id"],
              "items": [{"drug_id": drug_id, "dose": "500mg", "frequency": "TDS",
                         "quantity": 15, "duration_days": 5}]},
        headers=_hdr(doc_token),
    )
    assert rx.status_code == 201, rx.text
    disp = await client.post(
        f"/api/v1/pharmacy/prescriptions/{rx.json()['id']}/dispense",
        json={"items": [{"prescription_item_id": rx.json()["items"][0]["id"],
                         "quantity_dispensed": 15}]},
        headers=_hdr(pharm_token),
    )
    assert disp.status_code == 200, disp.text

    invoice = await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "line_items": [
                  {"item_type": "bed_day", "description": "3 bed days", "quantity": 3, "unit_price": 5000},
                  {"item_type": "drug", "description": "Amoxicillin x15", "quantity": 15, "unit_price": 150},
              ]},
        headers=_hdr(bill_token),
    )
    inv = invoice.json()
    assert inv["total"] == 17250.0

    # Clearance check shows the outstanding balance
    clearance = await client.get(
        f"/api/v1/admissions/{adm_id}/billing-clearance", headers=_hdr(doc_token)
    )
    assert clearance.status_code == 200
    assert clearance.json()["cleared"] is False
    assert clearance.json()["outstanding"] == 17250.0

    # Discharge is blocked while the balance is unpaid
    blocked = await client.post(
        f"/api/v1/admissions/{adm_id}/discharge",
        json={"discharge_type": "normal", "discharge_summary": "Recovered"},
        headers=_hdr(doc_token),
    )
    assert blocked.status_code == 409, blocked.text
    assert "Billing not cleared" in blocked.json()["detail"]

    pay = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 17250.0, "payment_mode": "cash"},
        headers=_hdr(cash_token),
    )
    assert pay.status_code == 201, pay.text

    cleared = await client.get(
        f"/api/v1/admissions/{adm_id}/billing-clearance", headers=_hdr(doc_token)
    )
    assert cleared.json()["cleared"] is True

    dis = await client.post(
        f"/api/v1/admissions/{adm_id}/discharge",
        json={"discharge_type": "normal",
              "discharge_summary": "Pneumonia resolved; amoxicillin 5/7 to complete at home"},
        headers=_hdr(doc_token),
    )
    assert dis.status_code == 200, dis.text
    assert dis.json()["status"] == "discharged"
    assert dis.json()["discharge_summary"].startswith("Pneumonia resolved")

    # Bed freed
    wards = await client.get("/api/v1/admissions/wards", headers=_hdr(doc_token))
    our_ward = next(w for w in wards.json() if w["id"] == ward_id)
    our_bed = next(b for b in our_ward["beds"] if b["id"] == bed_id)
    assert our_bed["status"] == "available"


# ── Scenario 6: Death / mortuary ─────────────────────────────────────────────

async def test_s06_death_mortuary_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    nurse_token, _ = await auth_token(UserRole.nurse)
    doc_token, _ = await auth_token(UserRole.doctor)
    admin_token, _ = await auth_token(UserRole.admin)
    bill_token, _ = await auth_token(UserRole.billing_clerk)

    patient = await _register_patient(client, _hdr(rec_token), "Peter", "Flowsix", "0991000006")
    ward_id, bed_id = await _make_ward_and_bed(client, _hdr(admin_token), "ICU F6", "F6-1")

    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "emergency"},
        headers=_hdr(doc_token),
    )
    enc_id = enc.json()["id"]
    adm = await client.post(
        "/api/v1/admissions",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "ward_id": ward_id, "bed_id": bed_id},
        headers=_hdr(doc_token),
    )
    adm_id = adm.json()["id"]

    # Unpaid invoice exists — death discharge uses the billing override
    await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc_id,
              "line_items": [{"item_type": "bed_day", "description": "ICU day",
                              "quantity": 1, "unit_price": 20000}]},
        headers=_hdr(bill_token),
    )
    dis = await client.post(
        f"/api/v1/admissions/{adm_id}/discharge",
        json={"discharge_type": "death", "discharge_summary": "Died despite resuscitation",
              "billing_override": True},
        headers=_hdr(doc_token),
    )
    assert dis.status_code == 200, dis.text
    assert dis.json()["discharge_type"] == "death"

    # Death certification
    death = await client.post(
        "/api/v1/mortuary/deaths",
        json={"patient_id": patient["id"], "encounter_id": enc_id, "admission_id": adm_id,
              "date_of_death": datetime.now(timezone.utc).isoformat(),
              "place_of_death": "ICU",
              "immediate_cause": "Cardiac arrest",
              "underlying_cause": "Massive myocardial infarction"},
        headers=_hdr(doc_token),
    )
    assert death.status_code == 201, death.text
    death_id = death.json()["id"]
    assert death.json()["certificate_number"].startswith("DC")

    # Mortuary intake
    intake = await client.post(
        f"/api/v1/mortuary/deaths/{death_id}/intake",
        json={"tag_number": "TAG-F6-01", "compartment": "C2"},
        headers=_hdr(nurse_token),
    )
    assert intake.status_code == 201, intake.text
    intake_id = intake.json()["id"]

    # Release before family notification is refused
    early = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json={"released_to_name": "James Flowsix", "released_to_relationship": "brother",
              "released_to_id_number": "MW-ID-9911"},
        headers=_hdr(doc_token),
    )
    assert early.status_code == 422, early.text

    # Family notification record
    notify = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/notify-family",
        json={"notified_person_name": "James Flowsix",
              "notified_person_relationship": "brother",
              "notified_person_phone": "0999333222"},
        headers=_hdr(nurse_token),
    )
    assert notify.status_code == 200, notify.text
    assert notify.json()["family_notified"] is True

    # Permit generation on release
    release = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json={"released_to_name": "James Flowsix", "released_to_relationship": "brother",
              "released_to_id_number": "MW-ID-9911"},
        headers=_hdr(doc_token),
    )
    assert release.status_code == 200, release.text
    assert release.json()["status"] == "released"
    assert release.json()["release_permit_number"].startswith("BRP")


# ── Scenario 7: Referral + follow-up scheduling ──────────────────────────────

async def test_s07_referral_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    doc_token, doc = await auth_token(UserRole.doctor)

    patient = await _register_patient(client, _hdr(rec_token), "Esther", "Flowseven", "0991000007")
    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd",
              "chief_complaint": "Suspicious breast lump"},
        headers=_hdr(doc_token),
    )
    enc_id = enc.json()["id"]

    referral = await client.post(
        "/api/v1/referrals",
        json={"encounter_id": enc_id, "patient_id": patient["id"],
              "destination_facility": "Queen Elizabeth Central Hospital",
              "destination_department": "Surgical Oncology",
              "urgency": "urgent",
              "reason": "Breast lump requiring specialist biopsy",
              "letter_text": "Dear colleague, please assess this 41-year-old..."},
        headers=_hdr(doc_token),
    )
    assert referral.status_code == 201, referral.text
    ref_id = referral.json()["id"]

    enc_after = await client.get(f"/api/v1/encounters/{enc_id}", headers=_hdr(doc_token))
    assert enc_after.json()["status"] == "referred"

    feedback = await client.patch(
        f"/api/v1/referrals/{ref_id}/feedback",
        json={"status": "accepted", "accepting_provider": "Dr. Banda",
              "feedback_notes": "Booked for biopsy next Tuesday"},
        headers=_hdr(doc_token),
    )
    assert feedback.status_code == 200, feedback.text
    assert feedback.json()["status"] == "accepted"

    # Follow-up appointment back at ZCPC after the specialist visit
    follow_up = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "provider_id": doc.id,
              "scheduled_datetime": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
              "duration_minutes": 20, "appointment_type": "follow_up",
              "visit_reason": "Post-referral review of biopsy results"},
        headers=_hdr(rec_token),
    )
    assert follow_up.status_code == 201, follow_up.text
    assert follow_up.json()["status"] == "scheduled"


# ── Scenario 8: Payments — partial, receipts, reconciliation ─────────────────

async def test_s08_payments_receipts_reconciliation(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    doc_token, _ = await auth_token(UserRole.doctor)
    bill_token, _ = await auth_token(UserRole.billing_clerk)
    cash_token, _ = await auth_token(UserRole.cashier)

    patient = await _register_patient(client, _hdr(rec_token), "Blessings", "Floweight", "0991000008")
    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd"},
        headers=_hdr(doc_token),
    )
    invoice = await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc.json()["id"],
              "line_items": [{"item_type": "procedure", "description": "Minor suturing",
                              "quantity": 1, "unit_price": 10000}]},
        headers=_hdr(bill_token),
    )
    inv = invoice.json()

    # Partial cash payment
    p1 = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 4000.0, "payment_mode": "cash"},
        headers=_hdr(cash_token),
    )
    assert p1.status_code == 201, p1.text
    p1_data = p1.json()
    assert p1_data["receipt_number"].startswith("RCT")

    partial = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(cash_token))
    assert partial.json()["status"] == "partial"
    assert partial.json()["balance"] == 6000.0

    # Printable receipt payload
    receipt = await client.get(
        f"/api/v1/billing/payments/{p1_data['id']}/receipt", headers=_hdr(cash_token)
    )
    assert receipt.status_code == 200, receipt.text
    r = receipt.json()
    assert r["receipt_number"] == p1_data["receipt_number"]
    assert r["invoice_number"] == inv["invoice_number"]
    assert r["patient_mrn"] == patient["mrn"]
    assert r["amount"] == 4000.0
    assert r["payment_mode"] == "cash"

    # Balance settled by M-Pesa
    p2 = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 6000.0, "payment_mode": "mpesa", "reference": "MP240704XYZ"},
        headers=_hdr(cash_token),
    )
    assert p2.status_code == 201
    paid = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(cash_token))
    assert paid.json()["status"] == "paid"

    # Daily reconciliation includes both payments (shared DB → tolerant asserts)
    recon = await client.get("/api/v1/billing/reconciliation", headers=_hdr(cash_token))
    assert recon.status_code == 200, recon.text
    data = recon.json()
    assert data["payment_count"] >= 2
    assert data["total_collected"] >= 10000.0
    assert data["by_mode"]["cash"]["total"] >= 4000.0
    assert data["by_mode"]["mpesa"]["total"] >= 6000.0
    receipt_numbers = [p["receipt_number"] for p in data["payments"]]
    assert p1_data["receipt_number"] in receipt_numbers
    assert p2.json()["receipt_number"] in receipt_numbers


# ── Scenario 9: Insurance claim lifecycle ────────────────────────────────────

async def test_s09_insurance_claim_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    doc_token, _ = await auth_token(UserRole.doctor)
    bill_token, _ = await auth_token(UserRole.billing_clerk)
    cash_token, _ = await auth_token(UserRole.cashier)

    patient = await _register_patient(client, _hdr(rec_token), "Dorothy", "Flownine", "0991000009")

    # Insurer lookup
    insurer = await client.post(
        "/api/v1/insurance/insurers",
        json={"name": "MedSure Insurance Co", "payer_type": "insurance",
              "contact_person": "Claims Dept", "phone": "01822000"},
        headers=_hdr(bill_token),
    )
    assert insurer.status_code == 201, insurer.text
    insurer_id = insurer.json()["id"]

    lookup = await client.get("/api/v1/insurance/insurers?q=MedSure", headers=_hdr(rec_token))
    assert lookup.status_code == 200
    assert any(i["id"] == insurer_id for i in lookup.json())

    # Member registration + verification
    member = await client.post(
        "/api/v1/insurance/members",
        json={"insurer_id": insurer_id, "patient_id": patient["id"],
              "member_number": "MS-88121", "plan_name": "Gold",
              "valid_from": (date.today() - timedelta(days=100)).isoformat(),
              "valid_to": (date.today() + timedelta(days=265)).isoformat()},
        headers=_hdr(rec_token),
    )
    assert member.status_code == 201, member.text
    verify = await client.get(
        f"/api/v1/insurance/members/verify?insurer_id={insurer_id}&member_number=MS-88121",
        headers=_hdr(rec_token),
    )
    assert verify.status_code == 200, verify.text
    assert verify.json()["verified"] is True

    # Pre-authorization
    preauth = await client.post(
        "/api/v1/insurance/preauth",
        json={"insurer_id": insurer_id, "patient_id": patient["id"],
              "member_id": member.json()["id"],
              "service_description": "Laparoscopic cholecystectomy",
              "estimated_amount": 10000},
        headers=_hdr(doc_token),
    )
    assert preauth.status_code == 201, preauth.text
    pa_approved = await client.patch(
        f"/api/v1/insurance/preauth/{preauth.json()['id']}/decision",
        json={"status": "approved", "decision_notes": "Approved per policy"},
        headers=_hdr(bill_token),
    )
    assert pa_approved.status_code == 200, pa_approved.text
    assert pa_approved.json()["auth_number"].startswith("PA")

    # Invoice, co-payment split, claim
    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd"},
        headers=_hdr(doc_token),
    )
    invoice = await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc.json()["id"],
              "payment_mode": "insurance",
              "line_items": [{"item_type": "procedure", "description": "Cholecystectomy",
                              "quantity": 1, "unit_price": 10000}]},
        headers=_hdr(bill_token),
    )
    inv = invoice.json()

    # Patient pays the 2,000 co-payment in cash
    copay = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 2000.0, "payment_mode": "cash", "notes": "Insurance co-payment"},
        headers=_hdr(cash_token),
    )
    assert copay.status_code == 201, copay.text

    claim = await client.post(
        "/api/v1/insurance/claims",
        json={"invoice_id": inv["id"], "insurer_id": insurer_id,
              "member_id": member.json()["id"], "preauth_id": preauth.json()["id"],
              "copay_amount": 2000.0},
        headers=_hdr(bill_token),
    )
    assert claim.status_code == 201, claim.text
    claim_data = claim.json()
    assert claim_data["claim_number"].startswith("CLM")
    assert claim_data["claimed_amount"] == 8000.0
    assert claim_data["copay_amount"] == 2000.0
    assert claim_data["status"] == "draft"

    submitted = await client.post(
        f"/api/v1/insurance/claims/{claim_data['id']}/submit", headers=_hdr(bill_token)
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    approved = await client.patch(
        f"/api/v1/insurance/claims/{claim_data['id']}/decision",
        json={"status": "approved"},
        headers=_hdr(bill_token),
    )
    assert approved.status_code == 200, approved.text
    assert approved.json()["approved_amount"] == 8000.0

    settled = await client.post(
        f"/api/v1/insurance/claims/{claim_data['id']}/settle", headers=_hdr(bill_token)
    )
    assert settled.status_code == 200, settled.text
    assert settled.json()["status"] == "settled"

    final_inv = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(bill_token))
    assert final_inv.json()["status"] == "paid"
    assert final_inv.json()["balance"] == 0.0
    modes = [p["payment_mode"] for p in final_inv.json()["payments"]]
    assert "insurance" in modes and "cash" in modes

    # Rejection handling: reason is mandatory; a rejected invoice can be re-claimed
    enc2 = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd"},
        headers=_hdr(doc_token),
    )
    inv2 = (await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc2.json()["id"],
              "payment_mode": "insurance",
              "line_items": [{"item_type": "lab_test", "description": "MRI referral fee",
                              "quantity": 1, "unit_price": 5000}]},
        headers=_hdr(bill_token),
    )).json()
    claim2 = (await client.post(
        "/api/v1/insurance/claims",
        json={"invoice_id": inv2["id"], "insurer_id": insurer_id, "copay_amount": 0},
        headers=_hdr(bill_token),
    )).json()
    await client.post(f"/api/v1/insurance/claims/{claim2['id']}/submit", headers=_hdr(bill_token))

    no_reason = await client.patch(
        f"/api/v1/insurance/claims/{claim2['id']}/decision",
        json={"status": "rejected"},
        headers=_hdr(bill_token),
    )
    assert no_reason.status_code == 422

    rejected = await client.patch(
        f"/api/v1/insurance/claims/{claim2['id']}/decision",
        json={"status": "rejected", "rejection_reason": "Service not covered under Gold plan"},
        headers=_hdr(bill_token),
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    reclaim = await client.post(
        "/api/v1/insurance/claims",
        json={"invoice_id": inv2["id"], "insurer_id": insurer_id, "copay_amount": 0},
        headers=_hdr(bill_token),
    )
    assert reclaim.status_code == 201, reclaim.text


# ── Scenario 10: Medical scheme ──────────────────────────────────────────────

async def test_s10_medical_scheme_flow(client, auth_token):
    rec_token, _ = await auth_token(UserRole.receptionist)
    doc_token, _ = await auth_token(UserRole.doctor)
    bill_token, _ = await auth_token(UserRole.billing_clerk)
    cash_token, _ = await auth_token(UserRole.cashier)

    patient = await _register_patient(client, _hdr(rec_token), "Tamanda", "Flowten", "0991000010")
    patient2 = await _register_patient(client, _hdr(rec_token), "Zione", "Flowtenb", "0991000011")

    scheme = await client.post(
        "/api/v1/insurance/insurers",
        json={"name": "MASM Medical Scheme", "payer_type": "medical_scheme"},
        headers=_hdr(bill_token),
    )
    assert scheme.status_code == 201, scheme.text
    scheme_id = scheme.json()["id"]

    # Active member verifies OK
    member = await client.post(
        "/api/v1/insurance/members",
        json={"insurer_id": scheme_id, "patient_id": patient["id"],
              "member_number": "MASM-4451", "plan_name": "VIP",
              "valid_from": (date.today() - timedelta(days=30)).isoformat()},
        headers=_hdr(rec_token),
    )
    assert member.status_code == 201, member.text
    ok = await client.get(
        f"/api/v1/insurance/members/verify?insurer_id={scheme_id}&member_number=MASM-4451",
        headers=_hdr(rec_token),
    )
    assert ok.json()["verified"] is True
    assert ok.json()["payer_type"] == "medical_scheme"

    # Lapsed member is refused
    await client.post(
        "/api/v1/insurance/members",
        json={"insurer_id": scheme_id, "patient_id": patient2["id"],
              "member_number": "MASM-9990",
              "valid_from": (date.today() - timedelta(days=400)).isoformat(),
              "valid_to": (date.today() - timedelta(days=1)).isoformat()},
        headers=_hdr(rec_token),
    )
    lapsed = await client.get(
        f"/api/v1/insurance/members/verify?insurer_id={scheme_id}&member_number=MASM-9990",
        headers=_hdr(rec_token),
    )
    assert lapsed.json()["verified"] is False
    assert "expired" in lapsed.json()["reason"].lower()

    # Scheme billing: claim the full invoice, partial approval, member settles the shortfall
    enc = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"], "encounter_type": "opd"},
        headers=_hdr(doc_token),
    )
    inv = (await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": enc.json()["id"],
              "payment_mode": "insurance",
              "line_items": [{"item_type": "consultation", "description": "Specialist review",
                              "quantity": 1, "unit_price": 6000}]},
        headers=_hdr(bill_token),
    )).json()

    claim = (await client.post(
        "/api/v1/insurance/claims",
        json={"invoice_id": inv["id"], "insurer_id": scheme_id,
              "member_id": member.json()["id"], "copay_amount": 0},
        headers=_hdr(bill_token),
    )).json()
    assert claim["claimed_amount"] == 6000.0

    await client.post(f"/api/v1/insurance/claims/{claim['id']}/submit", headers=_hdr(bill_token))
    partial = await client.patch(
        f"/api/v1/insurance/claims/{claim['id']}/decision",
        json={"status": "partially_approved", "approved_amount": 4000.0},
        headers=_hdr(bill_token),
    )
    assert partial.status_code == 200, partial.text

    settled = await client.post(
        f"/api/v1/insurance/claims/{claim['id']}/settle", headers=_hdr(bill_token)
    )
    assert settled.status_code == 200, settled.text

    after_scheme = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(bill_token))
    assert after_scheme.json()["status"] == "partial"
    assert after_scheme.json()["balance"] == 2000.0

    member_pays = await client.post(
        f"/api/v1/billing/invoices/{inv['id']}/payments",
        json={"amount": 2000.0, "payment_mode": "cash", "notes": "Scheme shortfall"},
        headers=_hdr(cash_token),
    )
    assert member_pays.status_code == 201
    final = await client.get(f"/api/v1/billing/invoices/{inv['id']}", headers=_hdr(bill_token))
    assert final.json()["status"] == "paid"

    # Scheme statement
    statement = await client.get(
        f"/api/v1/insurance/insurers/{scheme_id}/statement", headers=_hdr(bill_token)
    )
    assert statement.status_code == 200, statement.text
    st = statement.json()
    assert st["insurer_name"] == "MASM Medical Scheme"
    assert st["claim_count"] >= 1
    assert st["total_claimed"] >= 6000.0
    assert st["total_settled"] >= 4000.0
    assert "settled" in st["counts_by_status"]
    assert any(line["claim_number"] == claim["claim_number"] for line in st["claims"])
