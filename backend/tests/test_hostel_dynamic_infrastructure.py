import pytest
import uuid
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select

from tests.conftest import TestAsyncSessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.hostel import Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed
from app.models.student import Student
from app.models.service import ServicePlan


@pytest.fixture
async def warden_auth_headers() -> dict:
    """Hostel Warden user."""
    async with TestAsyncSessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.email == "warden_test@institute.edu")
        )).scalars().first()
        if not user:
            user = User(
                email="warden_test@institute.edu",
                hashed_password="hashed_dummy_pw",
                first_name="Hostel",
                last_name="Warden",
                user_type="ADMIN",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = str(user.id)

    token = create_access_token(
        subject=user_id,
        extra_claims={
            "email": "warden_test@institute.edu",
            "user_type": "ADMIN",
            "roles": ["ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dynamic_floor_creation_and_duplicate_prevention(
    client: AsyncClient,
    auth_headers: dict,
    warden_auth_headers: dict
):
    """Test dynamic floor creation, duplicate prevention, and role restrictions."""
    async with TestAsyncSessionLocal() as session:
        building = (await session.execute(select(HostelBuilding))).scalars().first()
        assert building is not None, "Building required"
        b_id = str(building.id)

    unique_flr_num = 99

    # 1. Non-admin (Warden) should be forbidden (403)
    res_forbidden = await client.post(
        f"/api/v1/hostels/buildings/{b_id}/floors",
        headers=warden_auth_headers,
        json={"floor_number": unique_flr_num, "name": "Rooftop Floor"}
    )
    assert res_forbidden.status_code == 403

    # 2. Admin successfully creates floor
    res_ok = await client.post(
        f"/api/v1/hostels/buildings/{b_id}/floors",
        headers=auth_headers,
        json={"floor_number": unique_flr_num, "name": "Rooftop Floor"}
    )
    assert res_ok.status_code == 201, res_ok.text
    data = res_ok.json()
    assert data["floor_number"] == unique_flr_num
    assert data["name"] == "Rooftop Floor"
    floor_id = data["id"]

    # 3. Duplicate floor_number in same building should fail (400)
    res_dup = await client.post(
        f"/api/v1/hostels/buildings/{b_id}/floors",
        headers=auth_headers,
        json={"floor_number": unique_flr_num, "name": "Duplicate Floor"}
    )
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()

    # 4. Cleanup floor
    del_res = await client.delete(f"/api/v1/hostels/floors/{floor_id}", headers=auth_headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_dynamic_room_creation_with_auto_provisioned_beds(
    client: AsyncClient,
    auth_headers: dict
):
    """Test room creation with smart bed auto-provisioning and room deletion."""
    async with TestAsyncSessionLocal() as session:
        building = (await session.execute(select(HostelBuilding))).scalars().first()
        b_id = str(building.id)

    # Create temporary floor
    flr_res = await client.post(
        f"/api/v1/hostels/buildings/{b_id}/floors",
        headers=auth_headers,
        json={"floor_number": 88, "name": "Test Wing 88"}
    )
    assert flr_res.status_code == 201
    flr_id = flr_res.json()["id"]

    # 1. Create Room with Double Sharing (capacity 2) and auto_create_beds=True
    room_res = await client.post(
        f"/api/v1/hostels/floors/{flr_id}/rooms",
        headers=auth_headers,
        json={
            "room_number": "8801",
            "room_type": "DOUBLE",
            "capacity": 2,
            "has_attached_bathroom": True,
            "is_ac": True,
            "auto_create_beds": True
        }
    )
    assert room_res.status_code == 201, room_res.text
    room_data = room_res.json()
    assert room_data["room_number"] == "8801"
    assert room_data["capacity"] == 2
    assert len(room_data["beds"]) == 2
    assert room_data["beds"][0]["bed_label"] == "Bed A"
    assert room_data["beds"][0]["status"] == "AVAILABLE"
    assert room_data["beds"][1]["bed_label"] == "Bed B"
    assert room_data["beds"][1]["status"] == "AVAILABLE"
    room_id = room_data["id"]

    # 2. Add extra bed (Bed C)
    bed_res = await client.post(
        f"/api/v1/hostels/rooms/{room_id}/beds",
        headers=auth_headers,
        json={}
    )
    assert bed_res.status_code == 201, bed_res.text
    bed_data = bed_res.json()
    assert bed_data["bed_label"] == "Bed C"
    bed_id = bed_data["id"]

    # 3. Delete Bed C
    del_bed_res = await client.delete(f"/api/v1/hostels/beds/{bed_id}", headers=auth_headers)
    assert del_bed_res.status_code == 200

    # 4. Delete Room 8801
    del_room_res = await client.delete(f"/api/v1/hostels/rooms/{room_id}", headers=auth_headers)
    assert del_room_res.status_code == 200

    # 5. Delete Floor
    await client.delete(f"/api/v1/hostels/floors/{flr_id}", headers=auth_headers)


@pytest.mark.asyncio
async def test_occupied_asset_deletion_protection(
    client: AsyncClient,
    auth_headers: dict
):
    """Test that rooms and floors with active student allocations cannot be deleted."""
    async with TestAsyncSessionLocal() as session:
        building = (await session.execute(select(HostelBuilding))).scalars().first()
        b_id = str(building.id)
        plan = (await session.execute(select(ServicePlan).where(ServicePlan.is_active == True))).scalars().first()
        plan_id = str(plan.id)

        # Create unique student
        stu = Student(
            student_code=f"STU-H-{uuid.uuid4().hex[:6].upper()}",
            prn=f"PRN-H-{uuid.uuid4().hex[:6].upper()}",
            first_name="Hostel",
            last_name="Occupant",
            date_of_birth=date(2005, 5, 5),
            gender="MALE"
        )
        session.add(stu)
        await session.commit()
        await session.refresh(stu)
        stu_id = str(stu.id)

    import random
    flr_num = random.randint(100, 999)
    room_str = f"{flr_num}01"

    # 1. Create Floor & Room
    flr_res = await client.post(
        f"/api/v1/hostels/buildings/{b_id}/floors",
        headers=auth_headers,
        json={"floor_number": flr_num, "name": f"Protected Floor {flr_num}"}
    )
    assert flr_res.status_code == 201, flr_res.text
    flr_id = flr_res.json()["id"]

    room_res = await client.post(
        f"/api/v1/hostels/floors/{flr_id}/rooms",
        headers=auth_headers,
        json={"room_number": room_str, "capacity": 1, "auto_create_beds": True}
    )
    assert room_res.status_code == 201, room_res.text
    room_id = room_res.json()["id"]
    bed_id = room_res.json()["beds"][0]["id"]

    # 2. Allocate student to bed
    alloc_res = await client.post(
        "/api/v1/hostels/allocate",
        headers=auth_headers,
        json={
            "hostel_bed_id": bed_id,
            "student_id": stu_id,
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=60)).isoformat(),
            "service_plan_id": plan_id
        }
    )
    assert alloc_res.status_code in [200, 201], alloc_res.text
    alloc_id = alloc_res.json()["allocation_id"]

    # 3. Attempt to delete bed while OCCUPIED -> should fail (400)
    del_bed = await client.delete(f"/api/v1/hostels/beds/{bed_id}", headers=auth_headers)
    assert del_bed.status_code == 400
    assert "occupied" in del_bed.json()["detail"].lower()

    # 4. Attempt to delete room while bed is OCCUPIED -> should fail (400)
    del_room = await client.delete(f"/api/v1/hostels/rooms/{room_id}", headers=auth_headers)
    assert del_room.status_code == 400
    assert "occupied" in del_room.json()["detail"].lower()

    # 5. Attempt to delete floor while bed is OCCUPIED -> should fail (400)
    del_flr = await client.delete(f"/api/v1/hostels/floors/{flr_id}", headers=auth_headers)
    assert del_flr.status_code == 400
    assert "occupied" in del_flr.json()["detail"].lower()

    # 6. Check out student
    checkout_res = await client.post(
        f"/api/v1/hostels/check-out/{alloc_id}",
        headers=auth_headers,
        json={"allocation_id": alloc_id, "refund_deposit": False}
    )
    assert checkout_res.status_code == 200

    # 7. Now safe deletion succeeds
    del_room_ok = await client.delete(f"/api/v1/hostels/rooms/{room_id}", headers=auth_headers)
    assert del_room_ok.status_code == 200

    del_flr_ok = await client.delete(f"/api/v1/hostels/floors/{flr_id}", headers=auth_headers)
    assert del_flr_ok.status_code == 200
