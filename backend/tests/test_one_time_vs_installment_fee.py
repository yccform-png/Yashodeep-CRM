import pytest
from decimal import Decimal
from datetime import date
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.modules.fees.pricing_engine import PricingEngine


@pytest.mark.asyncio
async def test_pricing_engine_dual_pricing():
    # 1. Course dual pricing
    # One-Time fee: ₹30,000, Installment fee: ₹35,000, Base fee: ₹35,000
    res_one_time = PricingEngine.calculate_fees(
        base_course_fee=Decimal("35000.00"),
        one_time_course_fee=Decimal("30000.00"),
        installment_course_fee=Decimal("35000.00"),
        number_of_installments=1
    )
    assert res_one_time.total_amount == Decimal("30000.00")
    assert len(res_one_time.items) == 1
    assert "One-Time Rate" in res_one_time.items[0].description
    assert len(res_one_time.installments) == 1
    assert res_one_time.installments[0].amount == Decimal("30000.00")

    # Installment plan (3 installments)
    res_installment = PricingEngine.calculate_fees(
        base_course_fee=Decimal("35000.00"),
        one_time_course_fee=Decimal("30000.00"),
        installment_course_fee=Decimal("35000.00"),
        number_of_installments=3
    )
    assert res_installment.total_amount == Decimal("35000.00")
    assert len(res_installment.items) == 1
    assert "Installment Rate" in res_installment.items[0].description
    assert len(res_installment.installments) == 3
    # Check sum of installments
    assert sum(i.amount for i in res_installment.installments) == Decimal("35000.00")

    # 2. Package Group dual pricing
    res_pkg_onetime = PricingEngine.calculate_fees(
        package_group_fee=Decimal("20000.00"),
        one_time_package_fee=Decimal("18000.00"),
        installment_package_fee=Decimal("22000.00"),
        number_of_installments=1
    )
    assert res_pkg_onetime.total_amount == Decimal("18000.00")
    assert "One-Time Rate" in res_pkg_onetime.items[0].description

    res_pkg_inst = PricingEngine.calculate_fees(
        package_group_fee=Decimal("20000.00"),
        one_time_package_fee=Decimal("18000.00"),
        installment_package_fee=Decimal("22000.00"),
        number_of_installments=2
    )
    assert res_pkg_inst.total_amount == Decimal("22000.00")
    assert "Installment Rate" in res_pkg_inst.items[0].description

    # 3. Fallback when one_time or installment fee is None or zero
    res_fallback = PricingEngine.calculate_fees(
        base_course_fee=Decimal("25000.00"),
        one_time_course_fee=None,
        installment_course_fee=None,
        number_of_installments=1
    )
    assert res_fallback.total_amount == Decimal("25000.00")
    assert res_fallback.items[0].description == "Course Tuition Fee"


@pytest.mark.asyncio
async def test_preview_api_dual_pricing(auth_headers):
    headers = auth_headers
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a test course with dual pricing
        course_payload = {
            "name": "Physics NEET Special",
            "code": "NEET-PHY-2026",
            "is_universal": True,
            "duration_months": 12,
            "initial_base_fee": 40000.00,
            "one_time_fee": 36000.00,
            "installment_fee": 42000.00,
            "subject_ids": []
        }
        res = await ac.post("/api/v1/academics/courses", json=course_payload, headers=headers)
        assert res.status_code == 201, res.text
        crs = res.json()
        assert float(crs["current_version"]["one_time_fee"]) == 36000.00
        assert float(crs["current_version"]["installment_fee"]) == 42000.00
        cver_id = crs["current_version"]["id"]

        # 1. Preview with 1 installment (One-Time)
        prev_one_time = await ac.post("/api/v1/fees/preview", json={
            "course_version_id": cver_id,
            "number_of_installments": 1,
            "admission_date": "2026-06-01"
        }, headers=headers)
        assert prev_one_time.status_code == 200, prev_one_time.text
        p1 = prev_one_time.json()
        assert float(p1["total_amount"]) == 36000.00
        assert len(p1["installments"]) == 1

        # 2. Preview with 3 installments
        prev_inst = await ac.post("/api/v1/fees/preview", json={
            "course_version_id": cver_id,
            "number_of_installments": 3,
            "admission_date": "2026-06-01"
        }, headers=headers)
        assert prev_inst.status_code == 200, prev_inst.text
        p3 = prev_inst.json()
        assert float(p3["total_amount"]) == 42000.00
        assert len(p3["installments"]) == 3


@pytest.mark.asyncio
async def test_list_invoices_class_batch_fields_and_filtering(auth_headers):
    headers = auth_headers
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/fees/invoices", headers=headers)
        assert res.status_code == 200, res.text
        invoices = res.json()
        assert isinstance(invoices, list)
        if len(invoices) > 0:
            first_inv = invoices[0]
            assert "class_id" in first_inv
            assert "class_name" in first_inv
            assert "batch_id" in first_inv
            assert "batch_name" in first_inv
            assert "course_name" in first_inv

        # Test querying with arbitrary valid class_id
        res_class = await ac.get("/api/v1/fees/invoices?class_id=00000000-0000-0000-0000-000000000000", headers=headers)
        assert res_class.status_code == 200
        assert res_class.json() == []

        # Test querying with arbitrary valid batch_id
        res_batch = await ac.get("/api/v1/fees/invoices?batch_id=00000000-0000-0000-0000-000000000000", headers=headers)
        assert res_batch.status_code == 200
        assert res_batch.json() == []
