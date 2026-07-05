"""Financial integrity tests (audit N3): negative/zero payments, negative
line items, and excessive discounts must be rejected."""
import pytest
from httpx import AsyncClient
from app.models.user import UserRole


async def _make_invoice(client: AsyncClient, auth_token, *, discount=0.0, unit_price=1000.0):
    rec_token, _ = await auth_token(role=UserRole.receptionist, employee_id="RECBILL")
    doc_token, _ = await auth_token(role=UserRole.doctor, employee_id="DOCBILL")
    clerk_token, _ = await auth_token(role=UserRole.billing_clerk, employee_id="CLKBILL")

    patient = (await client.post(
        "/api/v1/patients",
        json={"first_name": "Bill", "last_name": "Payer", "gender": "male"},
        headers={"Authorization": f"Bearer {rec_token}"},
    )).json()
    encounter = (await client.post(
        "/api/v1/encounters",
        json={"patient_id": patient["id"]},
        headers={"Authorization": f"Bearer {doc_token}"},
    )).json()
    resp = await client.post(
        "/api/v1/billing/invoices",
        json={"patient_id": patient["id"], "encounter_id": encounter["id"],
              "discount": discount,
              "line_items": [{"description": "Consultation", "quantity": 1, "unit_price": unit_price}]},
        headers={"Authorization": f"Bearer {clerk_token}"},
    )
    return resp, clerk_token


@pytest.mark.asyncio
async def test_negative_payment_rejected(client: AsyncClient, auth_token):
    resp, clerk_token = await _make_invoice(client, auth_token)
    assert resp.status_code == 201, resp.text
    invoice = resp.json()
    pay = await client.post(
        f"/api/v1/billing/invoices/{invoice['id']}/payments",
        json={"amount": -500, "payment_mode": "cash"},
        headers={"Authorization": f"Bearer {clerk_token}"},
    )
    assert pay.status_code == 422


@pytest.mark.asyncio
async def test_overpayment_rejected(client: AsyncClient, auth_token):
    resp, clerk_token = await _make_invoice(client, auth_token)
    invoice = resp.json()
    pay = await client.post(
        f"/api/v1/billing/invoices/{invoice['id']}/payments",
        json={"amount": 99999, "payment_mode": "cash"},
        headers={"Authorization": f"Bearer {clerk_token}"},
    )
    assert pay.status_code == 400
    assert "exceeds outstanding balance" in str(pay.json()["detail"])


@pytest.mark.asyncio
async def test_valid_payment_marks_paid(client: AsyncClient, auth_token):
    resp, clerk_token = await _make_invoice(client, auth_token, unit_price=800.0)
    invoice = resp.json()
    pay = await client.post(
        f"/api/v1/billing/invoices/{invoice['id']}/payments",
        json={"amount": 800.0, "payment_mode": "cash"},
        headers={"Authorization": f"Bearer {clerk_token}"},
    )
    assert pay.status_code == 201, pay.text
    updated = (await client.get(
        f"/api/v1/billing/invoices/{invoice['id']}",
        headers={"Authorization": f"Bearer {clerk_token}"},
    )).json()
    assert updated["status"] == "paid"
    assert updated["balance"] == 0


@pytest.mark.asyncio
async def test_negative_line_item_rejected(client: AsyncClient, auth_token):
    resp, _ = await _make_invoice(client, auth_token, unit_price=-100.0)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_discount_exceeding_subtotal_rejected(client: AsyncClient, auth_token):
    resp, _ = await _make_invoice(client, auth_token, discount=5000.0, unit_price=1000.0)
    assert resp.status_code == 400
    assert "Discount cannot exceed" in str(resp.json()["detail"])
