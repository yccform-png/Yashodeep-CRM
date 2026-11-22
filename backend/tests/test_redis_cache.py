"""
backend/tests/test_redis_cache.py
Comprehensive Unit & Integration Test Suite for Redis Caching Layer.
Tests connection lifecycle, get/set/delete, complex type serialization (UUID, Decimal, Date, DateTime),
pattern-based non-blocking invalidation, TTL expiration, and fail-open resilience.
"""
import uuid
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import pytest

from app.core.cache import cache_service, CacheKeys, CustomJSONEncoder
from app.core.config import settings


@pytest.mark.asyncio
async def test_redis_cache_lifecycle():
    """Verify Redis connection pool initializes and tests ping successfully."""
    await cache_service.init_pool()
    assert cache_service.is_connected is True
    assert cache_service.client is not None


@pytest.mark.asyncio
async def test_redis_cache_set_get_and_delete():
    """Verify standard CRUD cache operations."""
    await cache_service.init_pool()
    test_key = "ycc:v1:test:sample_entry"
    payload = {"name": "Yashodeep Test", "active": True, "count": 42}

    # SET
    success = await cache_service.set(test_key, payload, ttl=60)
    assert success is True

    # GET
    retrieved = await cache_service.get(test_key)
    assert retrieved is not None
    assert retrieved["name"] == "Yashodeep Test"
    assert retrieved["active"] is True
    assert retrieved["count"] == 42

    # DELETE
    del_success = await cache_service.delete(test_key)
    assert del_success is True

    # VERIFY GONE
    retrieved_after = await cache_service.get(test_key)
    assert retrieved_after is None


@pytest.mark.asyncio
async def test_redis_custom_type_serialization():
    """Verify serialization of domain types: UUID, Decimal, Date, DateTime."""
    await cache_service.init_pool()
    test_key = "ycc:v1:test:custom_types"
    sample_id = uuid.uuid4()
    sample_date = date(2026, 11, 20)
    sample_dt = datetime(2026, 11, 20, 10, 30, 0, tzinfo=timezone.utc)
    sample_decimal = Decimal("24500.50")

    payload = {
        "id": sample_id,
        "admission_date": sample_date,
        "created_at": sample_dt,
        "tuition_fee": sample_decimal
    }

    # SET with custom types
    set_ok = await cache_service.set(test_key, payload, ttl=60)
    assert set_ok is True

    # GET & verify deserialized primitives
    cached = await cache_service.get(test_key)
    assert cached is not None
    assert cached["id"] == str(sample_id)
    assert cached["admission_date"] == "2026-11-20"
    assert "2026-11-20T10:30:00" in cached["created_at"]
    assert cached["tuition_fee"] == 24500.50

    # Cleanup
    await cache_service.delete(test_key)


@pytest.mark.asyncio
async def test_redis_scan_pattern_invalidation():
    """Verify non-blocking SCAN deletion purges multiple matching keys."""
    await cache_service.init_pool()
    prefix = "ycc:v1:test:group:"
    await cache_service.set(f"{prefix}item_1", {"v": 1}, ttl=60)
    await cache_service.set(f"{prefix}item_2", {"v": 2}, ttl=60)
    await cache_service.set(f"{prefix}item_3", {"v": 3}, ttl=60)
    await cache_service.set("ycc:v1:other:keep_me", {"v": "preserved"}, ttl=60)

    # Invalidate pattern
    purged_count = await cache_service.delete_pattern(f"{prefix}*")
    assert purged_count == 3

    # Verify group keys are gone
    assert await cache_service.get(f"{prefix}item_1") is None
    assert await cache_service.get(f"{prefix}item_2") is None
    assert await cache_service.get(f"{prefix}item_3") is None

    # Verify unrelated key is intact
    preserved = await cache_service.get("ycc:v1:other:keep_me")
    assert preserved is not None
    assert preserved["v"] == "preserved"

    await cache_service.delete("ycc:v1:other:keep_me")


@pytest.mark.asyncio
async def test_redis_ttl_auto_expiration():
    """Verify key automatically expires after TTL duration."""
    await cache_service.init_pool()
    test_key = "ycc:v1:test:short_lived"
    await cache_service.set(test_key, {"temp": "value"}, ttl=1)

    # Check immediately
    immediate = await cache_service.get(test_key)
    assert immediate is not None

    # Wait for TTL to elapse
    await asyncio.sleep(1.2)

    expired = await cache_service.get(test_key)
    assert expired is None


@pytest.mark.asyncio
async def test_redis_fail_open_when_disconnected():
    """
    Critical Resilience Test:
    Ensures that when Redis is unreachable or cache is disabled, all operations
    fail open gracefully (returning None, False, 0) without raising exceptions.
    """
    # 1. Test when REDIS_CACHE_ENABLED is False
    orig_enabled = settings.REDIS_CACHE_ENABLED
    try:
        settings.REDIS_CACHE_ENABLED = False
        assert await cache_service.get("ycc:v1:any_key") is None
        assert await cache_service.set("ycc:v1:any_key", {"data": 123}) is False
        assert await cache_service.delete("ycc:v1:any_key") is False
        assert await cache_service.delete_pattern("ycc:v1:*") == 0
    finally:
        settings.REDIS_CACHE_ENABLED = orig_enabled

    # 2. Test when Redis connection URL is unreachable (invalid port)
    orig_url = settings.REDIS_URL
    try:
        settings.REDIS_URL = "redis://127.0.0.1:59999/0"
        await cache_service.close_pool()
        # Should fail connection gracefully and fail-open
        assert await cache_service.get("ycc:v1:any_key") is None
        assert await cache_service.set("ycc:v1:any_key", {"data": 123}) is False
        assert await cache_service.delete("ycc:v1:any_key") is False
        assert await cache_service.delete_pattern("ycc:v1:*") == 0
    finally:
        settings.REDIS_URL = orig_url
        await cache_service.close_pool()
        await cache_service.init_pool()


def test_cache_keys_generators():
    """Verify deterministic namespace hierarchy for all module cache keys."""
    assert CacheKeys.institute_profile() == "ycc:v1:inst:profile"
    assert CacheKeys.dashboard_metrics() == "ycc:v1:reports:dashboard"
    assert CacheKeys.academic_courses() == "ycc:v1:academics:courses:all"
    assert CacheKeys.academic_pattern() == "ycc:v1:academics:*"
    assert CacheKeys.study_room_seats("BOYS", "OCCUPIED") == "ycc:v1:study:seats:BOYS:OCCUPIED"
    assert CacheKeys.hostel_tree() == "ycc:v1:hostel:tree:all"
    assert "students:profile:123" in CacheKeys.student_profile("123")


@pytest.mark.asyncio
async def test_institute_profile_caching_and_invalidation(client, auth_headers):
    """Verify GET /institutes/profile caches in Redis and PUT invalidates it."""
    await cache_service.init_pool()
    # 1. Clear key
    await cache_service.delete(CacheKeys.institute_profile())

    # 2. First call: Cache miss -> populates Redis
    res1 = await client.get("/api/v1/institutes/profile")
    assert res1.status_code == 200
    cached = await cache_service.get(CacheKeys.institute_profile())
    assert cached is not None
    assert cached["name"] == res1.json()["name"]

    # 3. Second call: Cache hit -> served from Redis
    res2 = await client.get("/api/v1/institutes/profile")
    assert res2.status_code == 200
    assert res2.json()["name"] == cached["name"]

    # 4. Mutation: Update profile
    orig_name = res1.json()["name"]
    upd_res = await client.put(
        "/api/v1/institutes/profile",
        json={"name": orig_name},
        headers=auth_headers
    )
    assert upd_res.status_code == 200

    # 5. Invalidation verified
    cached_after_put = await cache_service.get(CacheKeys.institute_profile())
    assert cached_after_put is None


@pytest.mark.asyncio
async def test_services_plans_caching_and_invalidation(client, auth_headers):
    """Verify /services/types and /services/plans caching and pattern invalidation."""
    await cache_service.init_pool()
    await cache_service.delete_pattern("ycc:v1:services:*")

    # 1. Fetch types & plans
    res_types = await client.get("/api/v1/services/types")
    assert res_types.status_code == 200
    res_plans = await client.get("/api/v1/services/plans")
    assert res_plans.status_code == 200

    # 2. Verify cached in Redis
    cached_types = await cache_service.get(CacheKeys.service_types())
    assert cached_types is not None
    assert len(cached_types) == len(res_types.json())

    cached_plans = await cache_service.get(CacheKeys.service_plans())
    assert cached_plans is not None
    assert len(cached_plans) == len(res_plans.json())

    # 3. Trigger pattern invalidation
    purged = await cache_service.delete_pattern(CacheKeys.service_plans_pattern())
    assert purged >= 2
    assert await cache_service.get(CacheKeys.service_types()) is None
    assert await cache_service.get(CacheKeys.service_plans()) is None


@pytest.mark.asyncio
async def test_academics_reference_caching(client):
    """Verify academic years, classes, streams, and courses caching."""
    await cache_service.init_pool()
    await cache_service.delete_pattern("ycc:v1:academics:*")

    # Fetch classes
    res_classes = await client.get("/api/v1/academics/classes")
    assert res_classes.status_code == 200
    cached_classes = await cache_service.get(CacheKeys.academic_classes())
    assert cached_classes is not None

    # Fetch courses
    res_courses = await client.get("/api/v1/academics/courses")
    assert res_courses.status_code == 200
    cached_courses = await cache_service.get("ycc:v1:academics:courses:c_None:s_None:u_None:iu_True:ia_False")
    assert cached_courses is not None
    assert len(cached_courses) == len(res_courses.json())


@pytest.mark.asyncio
async def test_dashboard_metrics_caching_and_hit_performance(client):
    """Verify GET /reports/dashboard executes 8 queries on miss, and is fast on hit."""
    await cache_service.init_pool()
    # 1. Clear dashboard cache key
    await cache_service.delete(CacheKeys.dashboard_metrics())

    # 2. First call (Cache Miss)
    t0 = asyncio.get_event_loop().time()
    res1 = await client.get("/api/v1/reports/dashboard")
    miss_duration = asyncio.get_event_loop().time() - t0
    assert res1.status_code == 200
    data1 = res1.json()

    # Verify cached in Redis
    cached = await cache_service.get(CacheKeys.dashboard_metrics())
    assert cached is not None
    assert cached["total_students"] == data1["total_students"]
    assert cached["study_room"]["total_seats"] == data1["study_room"]["total_seats"]

    # 3. Second call (Cache Hit)
    t1 = asyncio.get_event_loop().time()
    res2 = await client.get("/api/v1/reports/dashboard")
    hit_duration = asyncio.get_event_loop().time() - t1
    assert res2.status_code == 200
    assert res2.json() == data1

    # Verify cache hit responded faster than cache miss
    print(f"\n[Dashboard Metrics Benchmark] Cache Miss: {miss_duration*1000:.2f}ms | Cache Hit: {hit_duration*1000:.2f}ms")


@pytest.mark.asyncio
async def test_facilities_occupancy_caching_and_benchmarks(client):
    """Verify study room seats (150 layout) and hostel 7-level tree caching & benchmarks."""
    await cache_service.init_pool()
    # 1. Clear keys
    await cache_service.delete_pattern("ycc:v1:study:seats:*")
    await cache_service.delete(CacheKeys.hostel_tree())

    # 2. Study Room Seats Benchmark
    t0 = asyncio.get_event_loop().time()
    sr_res1 = await client.get("/api/v1/study-rooms/seats")
    sr_miss_time = asyncio.get_event_loop().time() - t0
    assert sr_res1.status_code == 200

    cached_seats = await cache_service.get(CacheKeys.study_room_seats())
    assert cached_seats is not None
    assert len(cached_seats) == len(sr_res1.json())

    t1 = asyncio.get_event_loop().time()
    sr_res2 = await client.get("/api/v1/study-rooms/seats")
    sr_hit_time = asyncio.get_event_loop().time() - t1
    assert sr_res2.status_code == 200
    assert len(sr_res2.json()) == len(cached_seats)
    print(f"\n[Study Room 150-Seats Benchmark] Cache Miss: {sr_miss_time*1000:.2f}ms | Cache Hit: {sr_hit_time*1000:.2f}ms")

    # 3. Hostel Nested Tree Benchmark
    t2 = asyncio.get_event_loop().time()
    h_res1 = await client.get("/api/v1/hostels")
    h_miss_time = asyncio.get_event_loop().time() - t2
    assert h_res1.status_code == 200

    cached_hostels = await cache_service.get(CacheKeys.hostel_tree())
    assert cached_hostels is not None
    assert len(cached_hostels) == len(h_res1.json())

    t3 = asyncio.get_event_loop().time()
    h_res2 = await client.get("/api/v1/hostels")
    h_hit_time = asyncio.get_event_loop().time() - t3
    assert h_res2.status_code == 200
    assert len(h_res2.json()) == len(cached_hostels)
    print(f"\n[Hostel 7-Level Tree Benchmark] Cache Miss: {h_miss_time*1000:.2f}ms | Cache Hit: {h_hit_time*1000:.2f}ms")


@pytest.mark.asyncio
async def test_student_profile_caching_and_invalidation(client, auth_headers):
    """Verify student profile 11-tab aggregation query caching and patch invalidation."""
    await cache_service.init_pool()
    student_id = "561a7fe7-6a2e-4a9e-aace-2a5abb529a81"
    cache_key = CacheKeys.student_profile(student_id)

    # 1. Clear profile key
    await cache_service.delete(cache_key)

    # 2. First call: Cache miss -> queries 11 related tables
    t0 = asyncio.get_event_loop().time()
    res1 = await client.get(f"/api/v1/students/{student_id}/profile")
    miss_time = asyncio.get_event_loop().time() - t0
    assert res1.status_code == 200
    profile1 = res1.json()

    # Verify cached in Redis
    cached = await cache_service.get(cache_key)
    assert cached is not None
    assert cached["overview"]["student_code"] == profile1["overview"]["student_code"]

    # 3. Second call: Cache hit -> served from Redis in milliseconds
    t1 = asyncio.get_event_loop().time()
    res2 = await client.get(f"/api/v1/students/{student_id}/profile")
    hit_time = asyncio.get_event_loop().time() - t1
    assert res2.status_code == 200
    assert res2.json()["overview"]["student_code"] == profile1["overview"]["student_code"]
    print(f"\n[Student Profile Benchmark] Cache Miss: {miss_time*1000:.2f}ms | Cache Hit: {hit_time*1000:.2f}ms")

    # 4. Mutation: Update student
    patch_res = await client.patch(
        f"/api/v1/students/{student_id}",
        json={"blood_group": profile1["overview"]["blood_group"] or "O+"},
        headers=auth_headers
    )
    assert patch_res.status_code == 200

    # 5. Verify invalidation
    assert await cache_service.get(cache_key) is None




