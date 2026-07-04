"""Mortuary module tests — death certification, mortuary intake, family
notification, and body release with burial permit."""
import re
import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from app.models.user import UserRole


_CERT_RE = re.compile(r"^DC\d{6}$")
_PERMIT_RE = re.compile(r"^BRP\d{6}$")

# Unique phone per patient so the duplicate-patient 409 guard never trips.
_phone_counter = 0


async def _make_patient(client: AsyncClient, rec_token: str, *, suffix: str = "") -> dict:
    global _phone_counter
    _phone_counter += 1
    r = await client.post(
        "/api/v1/patients",
        json={
            "first_name": f"Mort{suffix}",
            "last_name": f"Patient{suffix}",
            "gender": "male",
            "date_of_birth": "1958-03-15",  # adult — avoids the under-18 consent gate
            "phone": f"+2659970{_phone_counter:04d}",
            "consent_given": True,
        },
        headers={"Authorization": f"Bearer {rec_token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _death_payload(patient_id: str, **overrides) -> dict:
    payload = {
        "patient_id": patient_id,
        "date_of_death": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        "place_of_death": "Male ward",
        "immediate_cause": "Cardiac arrest",
        "underlying_cause": "Severe malaria",
    }
    payload.update(overrides)
    return payload


# ── Happy path ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_mortuary_flow(client: AsyncClient, auth_token):
    """Certify death → intake → notify family → release with burial permit."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="MORTREC1")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="MORTDOC1")
    nurse_token, _ = await auth_token(role=UserRole.nurse, employee_id="MORTNUR1")
    patient = await _make_patient(client, rec_token, suffix="1")

    # 1. Doctor certifies the death
    r = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 201, r.text
    record = r.json()
    assert _CERT_RE.match(record["certificate_number"]), record["certificate_number"]
    assert record["patient_id"] == patient["id"]
    assert record["certified_by_id"] is not None
    death_id = record["id"]

    # 2. Nurse admits the body to the mortuary
    r = await client.post(
        f"/api/v1/mortuary/deaths/{death_id}/intake",
        json={"tag_number": "MT-2026-001", "compartment": "C3"},
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 201, r.text
    intake = r.json()
    assert intake["status"] == "admitted"
    assert intake["family_notified"] is False
    intake_id = intake["id"]

    # 3. Nurse records the family notification
    r = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/notify-family",
        json={
            "notified_person_name": "Grace Banda",
            "notified_person_relationship": "Daughter",
            "notified_person_phone": "+265991234567",
        },
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 200, r.text
    notified = r.json()
    assert notified["family_notified"] is True
    assert notified["notified_at"] is not None
    assert notified["notified_person_name"] == "Grace Banda"

    # 4. Doctor releases the body with a burial permit
    r = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json={
            "released_to_name": "Grace Banda",
            "released_to_relationship": "Daughter",
            "released_to_id_number": "MW-ID-778812",
        },
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 200, r.text
    released = r.json()
    assert released["status"] == "released"
    assert _PERMIT_RE.match(released["release_permit_number"]), released["release_permit_number"]
    assert released["released_at"] is not None

    # Detail view includes the mortuary admission
    r = await client.get(
        f"/api/v1/mortuary/deaths/{death_id}",
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 200
    detail = r.json()
    assert detail["mortuary_admission"] is not None
    assert detail["mortuary_admission"]["status"] == "released"


# ── Duplicate death record ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_duplicate_death_record_blocked(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="MORTREC2")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="MORTDOC2")
    patient = await _make_patient(client, rec_token, suffix="2")

    r1 = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r1.status_code == 201, r1.text

    r2 = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r2.status_code == 409
    detail = r2.json()["detail"]
    assert detail["certificate_number"] == r1.json()["certificate_number"]
    assert "already exists" in detail["message"].lower()


# ── Release guards ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_release_before_family_notification_blocked(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="MORTREC3")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="MORTDOC3")
    patient = await _make_patient(client, rec_token, suffix="3")

    r = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    death_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/mortuary/deaths/{death_id}/intake",
        json={"tag_number": "MT-2026-003"},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    intake_id = r.json()["id"]

    # Release without notifying family → 422
    r = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json={
            "released_to_name": "John Phiri",
            "released_to_relationship": "Brother",
            "released_to_id_number": "MW-ID-100003",
        },
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r.status_code == 422
    assert "notified" in r.text.lower()


@pytest.mark.asyncio
async def test_double_release_blocked(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="MORTREC4")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="MORTDOC4")
    patient = await _make_patient(client, rec_token, suffix="4")

    r = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    death_id = r.json()["id"]

    r = await client.post(
        f"/api/v1/mortuary/deaths/{death_id}/intake",
        json={"tag_number": "MT-2026-004"},
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    intake_id = r.json()["id"]

    await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/notify-family",
        json={"notified_person_name": "Mary Phiri", "notified_person_relationship": "Wife"},
        headers={"Authorization": f"Bearer {doc_token}"},
    )

    release_body = {
        "released_to_name": "Mary Phiri",
        "released_to_relationship": "Wife",
        "released_to_id_number": "MW-ID-100004",
    }
    r1 = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json=release_body,
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r1.status_code == 200, r1.text

    r2 = await client.post(
        f"/api/v1/mortuary/intakes/{intake_id}/release",
        json=release_body,
        headers={"Authorization": f"Bearer {doc_token}"},
    )
    assert r2.status_code == 409
    assert "already released" in r2.text.lower()


# ── Role guards ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_nurse_cannot_certify_death(client: AsyncClient, auth_token):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="MORTREC5")
    nurse_token, _ = await auth_token(role=UserRole.nurse, employee_id="MORTNUR5")
    patient = await _make_patient(client, rec_token, suffix="5")

    r = await client.post(
        "/api/v1/mortuary/deaths",
        json=_death_payload(patient["id"]),
        headers={"Authorization": f"Bearer {nurse_token}"},
    )
    assert r.status_code == 403
