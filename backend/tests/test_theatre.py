"""Theatre module tests — covers case booking, room double-booking, the
pre-op safety checklist gate, the operation lifecycle (book → checklist →
start → post-op → complete), and cancellation."""
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models.user import UserRole


def _future(days: float = 1, hour: int = 9, minute: int = 0) -> str:
    """Return an ISO8601 UTC datetime string in the future."""
    base = datetime.now(timezone.utc) + timedelta(days=days)
    dt = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.isoformat()


async def _make_patient(client: AsyncClient, rec_token: str, *, n: int) -> dict:
    """Register an adult patient with a unique name/phone for this module."""
    r = await client.post(
        "/api/v1/patients",
        json={
            "first_name": f"Theatre{n}",
            "last_name": "Case",
            "gender": "female",
            "date_of_birth": "1985-03-15",  # adult — no guardian consent gate
            "phone": f"0997{n:06d}",        # unique — avoids duplicate detection
            "consent_given": True,
        },
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _make_encounter(client: AsyncClient, doc_token: str, patient_id: str) -> dict:
    r = await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient_id},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _book_case(
    client: AsyncClient,
    token: str,
    *,
    patient_id: str,
    encounter_id: str,
    surgeon_id: str,
    scheduled_start: str,
    theatre_room: str = "Theatre 1",
    duration: int = 60,
    procedure: str = "Appendicectomy",
):
    return await client.post(
        "/api/v1/theatre/cases",
        json={
            "patient_id": patient_id,
            "encounter_id": encounter_id,
            "surgeon_id": surgeon_id,
            "theatre_room": theatre_room,
            "procedure_name": procedure,
            "scheduled_start": scheduled_start,
            "estimated_duration_minutes": duration,
        },
        headers={"Authorization": f"Bearer {token}"},
    )


def _checklist(**overrides) -> dict:
    body = {
        "consent_signed": True,
        "fasting_confirmed": True,
        "site_marked": True,
        "anaesthesia_review_done": True,
        "bloods_available": True,
    }
    body.update(overrides)
    return body


# ── Full lifecycle ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_theatre_pathway(client: AsyncClient, auth_token):
    """book → pre-op checklist → start → post-op → complete."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECTH1")
    doc_token, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCTH1")
    nurse_token, _ = await auth_token(role=UserRole.nurse, employee_id="NURTH1")

    patient = await _make_patient(client, rec_token, n=1)
    encounter = await _make_encounter(client, doc_token, patient["id"])

    # Book
    r = await _book_case(
        client, doc_token,
        patient_id=patient["id"], encounter_id=encounter["id"], surgeon_id=doctor.id,
        scheduled_start=_future(days=20, hour=8), duration=90,
    )
    assert r.status_code == 201, r.text
    case = r.json()
    assert case["status"] == "booked"
    assert case["theatre_room"] == "Theatre 1"
    assert case["surgeon_id"] == doctor.id
    assert case["admission_id"] is None  # day case
    case_id = case["id"]

    # Nurse completes the pre-op checklist → case moves to pre_op
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/preop-checklist",
        json=_checklist(notes="All safety checks done"),
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 201, r.text
    checklist = r.json()
    assert checklist["case_id"] == case_id
    assert checklist["consent_signed"] is True

    # A second checklist for the same case is rejected
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/preop-checklist",
        json=_checklist(),
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 409

    # Detail view shows the checklist and the pre_op status
    r = await client.get(
        f"/api/v1/theatre/cases/{case_id}",
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200
    detail = r.json()
    assert detail["status"] == "pre_op"
    assert detail["checklist"] is not None
    assert detail["checklist"]["site_marked"] is True

    # Start the operation
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/start",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 200, r.text
    case = r.json()
    assert case["status"] == "in_theatre"
    assert case["operation_started_at"] is not None

    # Record post-op notes → recovery
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/post-op",
        json={"operation_notes": "Uncomplicated appendicectomy",
              "findings": "Inflamed appendix, no perforation",
              "complications": None},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 200, r.text
    case = r.json()
    assert case["status"] == "recovery"
    assert case["operation_ended_at"] is not None
    assert case["operation_notes"] == "Uncomplicated appendicectomy"

    # Nurse discharges from recovery → completed
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/complete",
        json={"recovery_notes": "Stable, pain controlled, back to ward"},
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200, r.text
    case = r.json()
    assert case["status"] == "completed"
    assert case["recovery_discharged_at"] is not None
    assert case["recovery_notes"] == "Stable, pain controlled, back to ward"


# ── Room double-booking ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_room_double_booking_blocked(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECTH2")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCTH2")
    lead_token, lead = await auth_token(role=UserRole.surgical_lead, employee_id="SLTH2")
    surgeon = await create_test_user(
        employee_id="SURGTH2", full_name="Mr Surgeon TH2", role=UserRole.doctor,
    )

    p1 = await _make_patient(client, rec_token, n=2)
    p2 = await _make_patient(client, rec_token, n=3)
    e1 = await _make_encounter(client, doc_token, p1["id"])
    e2 = await _make_encounter(client, doc_token, p2["id"])

    # 08:00–10:00 in Theatre 1
    r1 = await _book_case(
        client, lead_token,
        patient_id=p1["id"], encounter_id=e1["id"], surgeon_id=surgeon.id,
        scheduled_start=_future(days=21, hour=8), duration=120,
    )
    assert r1.status_code == 201, r1.text

    # Overlapping 09:00 start in the same room → conflict
    r2 = await _book_case(
        client, lead_token,
        patient_id=p2["id"], encounter_id=e2["id"], surgeon_id=surgeon.id,
        scheduled_start=_future(days=21, hour=9), duration=60,
    )
    assert r2.status_code == 409, r2.text
    detail = r2.json()["detail"]
    assert detail["message"] == "Theatre room already booked for this time"
    assert detail["conflict_id"] == r1.json()["id"]

    # Back-to-back at 10:00 (no overlap) is allowed
    r3 = await _book_case(
        client, lead_token,
        patient_id=p2["id"], encounter_id=e2["id"], surgeon_id=surgeon.id,
        scheduled_start=_future(days=21, hour=10), duration=60,
    )
    assert r3.status_code == 201, r3.text


# ── Pre-op safety gate ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_start_blocked_without_checklist(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECTH3")
    doc_token, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCTH3")

    patient = await _make_patient(client, rec_token, n=4)
    encounter = await _make_encounter(client, doc_token, patient["id"])

    r = await _book_case(
        client, doc_token,
        patient_id=patient["id"], encounter_id=encounter["id"], surgeon_id=doctor.id,
        scheduled_start=_future(days=22, hour=8),
    )
    assert r.status_code == 201
    case_id = r.json()["id"]

    # No checklist yet → case is still booked → cannot start
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/start",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 422
    assert "pre_op" in r.text


@pytest.mark.asyncio
async def test_start_blocked_when_safety_item_unconfirmed(client: AsyncClient, auth_token):
    """A checklist with fasting unconfirmed must block the knife-to-skin step."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECTH4")
    doc_token, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCTH4")
    nurse_token, _ = await auth_token(role=UserRole.nurse, employee_id="NURTH4")

    patient = await _make_patient(client, rec_token, n=5)
    encounter = await _make_encounter(client, doc_token, patient["id"])

    r = await _book_case(
        client, doc_token,
        patient_id=patient["id"], encounter_id=encounter["id"], surgeon_id=doctor.id,
        scheduled_start=_future(days=23, hour=8),
    )
    assert r.status_code == 201
    case_id = r.json()["id"]

    # Checklist recorded, but fasting not confirmed
    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/preop-checklist",
        json=_checklist(fasting_confirmed=False),
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 201, r.text

    r = await client.post(
        f"/api/v1/theatre/cases/{case_id}/start",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 422
    assert "incomplete" in r.text.lower()


# ── Cancellation ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cancel_and_slot_reuse(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECTH5")
    doc_token, doctor = await auth_token(role=UserRole.doctor, employee_id="DOCTH5")

    p1 = await _make_patient(client, rec_token, n=6)
    p2 = await _make_patient(client, rec_token, n=7)
    e1 = await _make_encounter(client, doc_token, p1["id"])
    e2 = await _make_encounter(client, doc_token, p2["id"])

    slot = _future(days=24, hour=9)
    r1 = await _book_case(
        client, doc_token,
        patient_id=p1["id"], encounter_id=e1["id"], surgeon_id=doctor.id,
        scheduled_start=slot, duration=60,
    )
    assert r1.status_code == 201
    case_id = r1.json()["id"]

    # Cancel with a reason
    r = await client.patch(
        f"/api/v1/theatre/cases/{case_id}/cancel",
        json={"cancellation_reason": "Patient spiked a fever overnight"},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    assert r.json()["cancellation_reason"] == "Patient spiked a fever overnight"

    # Cancelling again → already terminal
    r = await client.patch(
        f"/api/v1/theatre/cases/{case_id}/cancel",
        json={"cancellation_reason": "Duplicate cancellation"},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 422
    assert "cancelled" in r.text.lower()

    # The cancelled case releases the slot for another booking
    r2 = await _book_case(
        client, doc_token,
        patient_id=p2["id"], encounter_id=e2["id"], surgeon_id=doctor.id,
        scheduled_start=slot, duration=60,
    )
    assert r2.status_code == 201, r2.text
