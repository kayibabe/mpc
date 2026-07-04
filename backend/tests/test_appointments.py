"""Appointment module tests — covers booking, double-booking, status machine,
check-in with encounter creation, cancellation, and availability query."""
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models.user import UserRole


def _future(days: float = 1, hour: int = 9, minute: int = 0) -> str:
    """Return an ISO8601 UTC datetime string in the future."""
    base = datetime.now(timezone.utc) + timedelta(days=days)
    dt = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.isoformat()


async def _make_patient(client: AsyncClient, rec_token: str, *, suffix: str = "") -> dict:
    r = await client.post(
        "/api/v1/patients",
        json={"first_name": f"Appt{suffix}", "last_name": "Patient",
              "gender": "male", "consent_given": True},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


async def _make_provider(create_test_user, *, suffix: str = "A") -> object:
    return await create_test_user(
        employee_id=f"PROV{suffix}",
        full_name=f"Dr Provider {suffix}",
        role=UserRole.doctor,
    )


# ── Booking ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_book_appointment(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT1")
    provider = await _make_provider(create_test_user, suffix="B1")
    patient = await _make_patient(client, rec_token, suffix="1")

    r = await client.post(
        "/api/v1/appointments",
        json={
            "patient_id": patient["id"],
            "provider_id": provider.id,
            "scheduled_datetime": _future(days=1, hour=10),
            "duration_minutes": 30,
            "appointment_type": "opd",
            "visit_reason": "Annual check-up",
        },
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    appt = r.json()
    assert appt["status"] == "scheduled"
    assert appt["patient_id"] == patient["id"]
    assert appt["provider_id"] == provider.id
    assert appt["duration_minutes"] == 30


@pytest.mark.asyncio
async def test_book_without_provider(client: AsyncClient, auth_token, create_test_user):
    """Walk-in booking without a specific provider is allowed."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT2")
    patient = await _make_patient(client, rec_token, suffix="2")

    r = await client.post(
        "/api/v1/appointments",
        json={
            "patient_id": patient["id"],
            "scheduled_datetime": _future(days=1, hour=11),
            "visit_reason": "Walk-in — no provider assigned yet",
        },
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["provider_id"] is None


@pytest.mark.asyncio
async def test_past_datetime_rejected(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT3")
    patient = await _make_patient(client, rec_token, suffix="3")
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": past},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 422
    assert "future" in r.text.lower()


# ── Double-booking ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_double_booking_blocked(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT4")
    provider = await _make_provider(create_test_user, suffix="B2")
    p1 = await _make_patient(client, rec_token, suffix="4a")
    p2 = await _make_patient(client, rec_token, suffix="4b")
    slot = _future(days=2, hour=9)

    r1 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p1["id"], "provider_id": provider.id,
              "scheduled_datetime": slot, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r1.status_code == 201

    # Same slot → conflict
    r2 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p2["id"], "provider_id": provider.id,
              "scheduled_datetime": slot, "duration_minutes": 15},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 409
    assert "conflict_id" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_overlapping_slot_blocked(client: AsyncClient, auth_token, create_test_user):
    """Appointment starting 15 min into a 30-min block should be rejected."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT5")
    provider = await _make_provider(create_test_user, suffix="B3")
    p1 = await _make_patient(client, rec_token, suffix="5a")
    p2 = await _make_patient(client, rec_token, suffix="5b")

    slot_start = datetime.now(timezone.utc) + timedelta(days=3)
    slot_start = slot_start.replace(hour=8, minute=0, second=0, microsecond=0)

    r1 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p1["id"], "provider_id": provider.id,
              "scheduled_datetime": slot_start.isoformat(), "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r1.status_code == 201

    overlap_start = (slot_start + timedelta(minutes=15)).isoformat()
    r2 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p2["id"], "provider_id": provider.id,
              "scheduled_datetime": overlap_start, "duration_minutes": 20},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_back_to_back_allowed(client: AsyncClient, auth_token, create_test_user):
    """Back-to-back (no overlap) must be allowed."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT6")
    provider = await _make_provider(create_test_user, suffix="B4")
    p1 = await _make_patient(client, rec_token, suffix="6a")
    p2 = await _make_patient(client, rec_token, suffix="6b")

    slot_start = datetime.now(timezone.utc) + timedelta(days=4)
    slot_start = slot_start.replace(hour=14, minute=0, second=0, microsecond=0)

    r1 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p1["id"], "provider_id": provider.id,
              "scheduled_datetime": slot_start.isoformat(), "duration_minutes": 15},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r1.status_code == 201

    next_slot = (slot_start + timedelta(minutes=15)).isoformat()
    r2 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p2["id"], "provider_id": provider.id,
              "scheduled_datetime": next_slot, "duration_minutes": 15},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 201, r2.text


@pytest.mark.asyncio
async def test_cancelled_slot_reusable(client: AsyncClient, auth_token, create_test_user):
    """After cancellation the time slot should be available to another patient."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT7")
    provider = await _make_provider(create_test_user, suffix="B5")
    p1 = await _make_patient(client, rec_token, suffix="7a")
    p2 = await _make_patient(client, rec_token, suffix="7b")

    slot = _future(days=5, hour=10)

    r1 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p1["id"], "provider_id": provider.id,
              "scheduled_datetime": slot, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r1.status_code == 201
    appt_id = r1.json()["id"]

    # Cancel it
    cancel = await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "cancelled", "cancellation_reason": "Patient called to cancel"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert cancel.status_code == 200

    # Now the slot is free
    r2 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p2["id"], "provider_id": provider.id,
              "scheduled_datetime": slot, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 201, r2.text


# ── Status machine ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_transitions(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT8")
    patient = await _make_patient(client, rec_token, suffix="8")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=6, hour=9)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201
    appt_id = r.json()["id"]

    # scheduled → confirmed
    r = await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "confirmed"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"

    # confirmed → arrived (via checkin endpoint)
    r = await client.post(
        f"/api/v1/appointments/{appt_id}/checkin",
        json={"chief_complaint": "Follow-up"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 200
    appt = r.json()
    assert appt["status"] == "arrived"
    assert appt["encounter_id"] is not None


@pytest.mark.asyncio
async def test_invalid_transition_rejected(client: AsyncClient, auth_token, create_test_user):
    """scheduled → completed is not a valid transition."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT9")
    patient = await _make_patient(client, rec_token, suffix="9")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=7, hour=9)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    r = await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "completed"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 422
    assert "completed" in r.text.lower() or "scheduled" in r.text.lower()


@pytest.mark.asyncio
async def test_cancel_requires_reason(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT10")
    patient = await _make_patient(client, rec_token, suffix="10")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=8, hour=9)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    # Cancel without reason → rejected
    r = await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "cancelled"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 422
    assert "cancellation_reason" in r.text.lower()


@pytest.mark.asyncio
async def test_terminal_state_immutable(client: AsyncClient, auth_token, create_test_user):
    """A cancelled appointment cannot be modified."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT11")
    patient = await _make_patient(client, rec_token, suffix="11")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=9, hour=9)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "cancelled", "cancellation_reason": "Test cancellation"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )

    r = await client.patch(
        f"/api/v1/appointments/{appt_id}",
        json={"status": "scheduled"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 409
    assert "cancelled" in r.text.lower()


# ── Check-in ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_checkin_creates_encounter(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT12")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCAT12")
    provider = await _make_provider(create_test_user, suffix="B6")
    patient = await _make_patient(client, rec_token, suffix="12")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "provider_id": provider.id,
              "scheduled_datetime": _future(days=10, hour=8),
              "visit_reason": "Antenatal visit"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/appointments/{appt_id}/checkin",
        json={"encounter_type": "opd", "chief_complaint": "ANC 28 weeks"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 200, r.text
    appt = r.json()
    assert appt["status"] == "arrived"
    assert appt["encounter_id"] is not None

    # Verify the encounter exists and is linked (doctor token required for GET /encounters/{id})
    enc_r = await client.get(
        f"/api/v1/encounters/{appt['encounter_id']}",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert enc_r.status_code == 200
    enc = enc_r.json()
    assert enc["patient_id"] == patient["id"]
    assert enc["attending_doctor_id"] == provider.id


@pytest.mark.asyncio
async def test_checkin_already_arrived_blocked(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT13")
    patient = await _make_patient(client, rec_token, suffix="13")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=11, hour=8)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    await client.post(
        f"/api/v1/appointments/{appt_id}/checkin",
        json={},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    # Second checkin → already arrived → 409
    r2 = await client.post(
        f"/api/v1/appointments/{appt_id}/checkin",
        json={},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 409


# ── DELETE (convenience cancel) ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_cancels_appointment(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT14")
    patient = await _make_patient(client, rec_token, suffix="14")

    r = await client.post(
        "/api/v1/appointments",
        json={"patient_id": patient["id"], "scheduled_datetime": _future(days=12, hour=9)},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    appt_id = r.json()["id"]

    r = await client.delete(
        f"/api/v1/appointments/{appt_id}",
        params={"cancellation_reason": "Receptionist cancelled on behalf of patient"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 204

    # Confirm status via GET
    r = await client.get(
        f"/api/v1/appointments/{appt_id}",
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.json()["status"] == "cancelled"


# ── Query / Availability ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_appointments_by_patient(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT15")
    patient = await _make_patient(client, rec_token, suffix="15")

    for day, hour in [(13, 9), (14, 10)]:
        await client.post(
            "/api/v1/appointments",
            json={"patient_id": patient["id"], "scheduled_datetime": _future(days=day, hour=hour)},
            headers={"Authorization": f"Bearer {rec_token}"},
        )

    r = await client.get(
        "/api/v1/appointments",
        params={"patient_id": patient["id"]},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_availability_endpoint(client: AsyncClient, auth_token, create_test_user):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT16")
    provider = await _make_provider(create_test_user, suffix="B7")
    p1 = await _make_patient(client, rec_token, suffix="16a")
    p2 = await _make_patient(client, rec_token, suffix="16b")

    check_day = datetime.now(timezone.utc) + timedelta(days=15)
    check_day = check_day.replace(hour=0, minute=0, second=0, microsecond=0)

    for hour in (9, 10):
        slot = check_day.replace(hour=hour).isoformat()
        patient = p1 if hour == 9 else p2
        await client.post(
            "/api/v1/appointments",
            json={"patient_id": patient["id"], "provider_id": provider.id,
                  "scheduled_datetime": slot, "duration_minutes": 30},
            headers={"Authorization": f"Bearer {rec_token}"},
        )

    r = await client.get(
        "/api/v1/appointments/availability",
        params={"provider_id": provider.id, "check_date": check_day.date().isoformat()},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.asyncio
async def test_reschedule_double_booking_blocked(client: AsyncClient, auth_token, create_test_user):
    """Rescheduling into a busy slot should be blocked."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECAT17")
    provider = await _make_provider(create_test_user, suffix="B8")
    p1 = await _make_patient(client, rec_token, suffix="17a")
    p2 = await _make_patient(client, rec_token, suffix="17b")

    slot_a = _future(days=16, hour=9)
    slot_b = _future(days=16, hour=10)

    r1 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p1["id"], "provider_id": provider.id,
              "scheduled_datetime": slot_a, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/appointments",
        json={"patient_id": p2["id"], "provider_id": provider.id,
              "scheduled_datetime": slot_b, "duration_minutes": 30},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r2.status_code == 201
    appt2_id = r2.json()["id"]

    # Reschedule appt2 into appt1's slot → conflict
    r3 = await client.patch(
        f"/api/v1/appointments/{appt2_id}",
        json={"scheduled_datetime": slot_a},
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r3.status_code == 409
