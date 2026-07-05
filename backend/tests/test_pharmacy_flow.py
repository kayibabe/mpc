"""End-to-end pharmacy safety tests: stock validation (C5), the backend
allergy/contraindication gate (C6), and dispense quantity capping (N4)."""
import pytest
from httpx import AsyncClient
from app.models.user import UserRole


async def _setup_flow(client: AsyncClient, auth_token, *, allergies=None, drug_name="Amoxicillin 500mg",
                      generic="amoxicillin", stock_qty=50, rx_qty=10):
    """Create patient → drug → stock → encounter → prescription. Returns dict of ids/tokens."""
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECFLOW")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCFLOW")
    pha_token, _ = await auth_token(role=UserRole.pharmacist, employee_id="PHAFLOW")

    patient = (await client.post(
        "/api/v1/patients",
        json={"first_name": "Flow", "last_name": "Patient", "gender": "female",
              **({"known_allergies": allergies} if allergies else {})},
        headers={"Authorization": f"Bearer {rec_token}"},
    )).json()

    drug = (await client.post(
        "/api/v1/pharmacy/drugs",
        json={"name": drug_name, "generic_name": generic, "form": "tablet"},
        headers={"Authorization": f"Bearer {pha_token}"},
    )).json()

    stock_resp = await client.post(
        f"/api/v1/pharmacy/drugs/{drug['id']}/stock",
        json={"batch_number": "B001", "expiry_date": "2030-01-01",
              "quantity_received": stock_qty, "received_date": "2026-01-01"},
        headers={"Authorization": f"Bearer {pha_token}"},
    )
    assert stock_resp.status_code == 201, stock_resp.text

    encounter = (await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"]},
        headers={"Authorization": f"Bearer {doc_token}"},
    )).json()

    rx_payload = {
        "patient_id": patient["id"], "encounter_id": encounter["id"],
        "items": [{"drug_id": drug["id"], "dose": "500mg", "frequency": "tds", "quantity": rx_qty}],
    }
    return {
        "patient": patient, "drug": drug, "encounter": encounter,
        "rx_payload": rx_payload,
        "rec_token": rec_token, "doc_token": doc_token, "pha_token": pha_token,
    }


@pytest.mark.asyncio
async def test_full_dispense_happy_path(client: AsyncClient, auth_token):
    ctx = await _setup_flow(client, auth_token)
    rx_resp = await client.post(
        "/api/v1/pharmacy/prescriptions", json=ctx["rx_payload"],
        headers={"Authorization": f"Bearer {ctx['doc_token']}"},
    )
    assert rx_resp.status_code == 201, rx_resp.text
    rx = rx_resp.json()

    disp = await client.post(
        f"/api/v1/pharmacy/prescriptions/{rx['id']}/dispense",
        json={"items": [{"prescription_item_id": rx["items"][0]["id"], "quantity_dispensed": 10}]},
        headers={"Authorization": f"Bearer {ctx['pha_token']}"},
    )
    assert disp.status_code == 200, disp.text
    assert disp.json()["status"] == "dispensed"


@pytest.mark.asyncio
async def test_dispense_insufficient_stock_rejected(client: AsyncClient, auth_token):
    ctx = await _setup_flow(client, auth_token, drug_name="Paracetamol 1g",
                            generic="paracetamol", stock_qty=5, rx_qty=200)
    rx = (await client.post(
        "/api/v1/pharmacy/prescriptions", json=ctx["rx_payload"],
        headers={"Authorization": f"Bearer {ctx['doc_token']}"},
    )).json()

    disp = await client.post(
        f"/api/v1/pharmacy/prescriptions/{rx['id']}/dispense",
        json={"items": [{"prescription_item_id": rx["items"][0]["id"], "quantity_dispensed": 200}]},
        headers={"Authorization": f"Bearer {ctx['pha_token']}"},
    )
    assert disp.status_code == 400
    assert "Insufficient stock" in str(disp.json()["detail"])


@pytest.mark.asyncio
async def test_prescription_blocked_on_allergy(client: AsyncClient, auth_token):
    ctx = await _setup_flow(client, auth_token, allergies="Penicillin, sulfa",
                            drug_name="Penicillin V 250mg", generic="penicillin")
    rx_resp = await client.post(
        "/api/v1/pharmacy/prescriptions", json=ctx["rx_payload"],
        headers={"Authorization": f"Bearer {ctx['doc_token']}"},
    )
    assert rx_resp.status_code == 409, rx_resp.text
    assert "conflicts" in rx_resp.json()["detail"]


@pytest.mark.asyncio
async def test_prescription_allergy_override_is_allowed_and_audited(client: AsyncClient, auth_token):
    ctx = await _setup_flow(client, auth_token, allergies="penicillin",
                            drug_name="Penicillin G 1MU", generic="penicillin")
    payload = {**ctx["rx_payload"], "override_allergy_block": True}
    rx_resp = await client.post(
        "/api/v1/pharmacy/prescriptions", json=payload,
        headers={"Authorization": f"Bearer {ctx['doc_token']}"},
    )
    assert rx_resp.status_code == 201, rx_resp.text

    # The override must appear in the audit trail
    adm_token, _ = await auth_token(role=UserRole.admin, employee_id="ADMFLOW")
    logs = (await client.get(
        "/api/v1/admin/audit-logs", params={"action": "allergy_override"},
        headers={"Authorization": f"Bearer {adm_token}"},
    )).json()
    assert any(entry["action"] == "allergy_override" for entry in logs)


@pytest.mark.asyncio
async def test_dispense_blocked_on_allergy_without_override(client: AsyncClient, auth_token):
    ctx = await _setup_flow(client, auth_token, allergies="ibuprofen",
                            drug_name="Ibuprofen 400mg", generic="ibuprofen")
    # Prescribe with override (doctor decided), then dispense WITHOUT override — pharmacist gate must trip
    payload = {**ctx["rx_payload"], "override_allergy_block": True}
    rx = (await client.post(
        "/api/v1/pharmacy/prescriptions", json=payload,
        headers={"Authorization": f"Bearer {ctx['doc_token']}"},
    )).json()

    disp = await client.post(
        f"/api/v1/pharmacy/prescriptions/{rx['id']}/dispense",
        json={"items": [{"prescription_item_id": rx["items"][0]["id"], "quantity_dispensed": 5}]},
        headers={"Authorization": f"Bearer {ctx['pha_token']}"},
    )
    assert disp.status_code == 409
    assert "conflicts" in disp.json()["detail"]
