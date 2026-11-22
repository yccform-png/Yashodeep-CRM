"""
backend/tests/test_cache_invalidation.py
Automated test suite verifying Redis cache invalidation consistency across all modules.
"""
import os
import re
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from app.core.cache import cache_service, CacheKeys, CacheInvalidator


def test_zero_raw_redis_patterns_in_modules():
    """
    Static code analysis test:
    Ensures NO raw 'ycc:v1:' string literals exist inside backend/app/modules/.
    All endpoints must exclusively use CacheKeys.* methods.
    """
    modules_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app", "modules"))
    raw_pattern = re.compile(r'["\']ycc:v1:[^"\']*["\']')
    violations = []

    for root, _, files in os.walk(modules_dir):
        if "__pycache__" in root:
            continue
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, start=1):
                        match = raw_pattern.search(line)
                        if match:
                            violations.append(f"{filepath}:{line_num} -> {match.group(0)}")

    assert not violations, f"Found hardcoded Redis key strings in modules (must use CacheKeys): {violations}"


@pytest.mark.asyncio
async def test_cache_keys_standard_patterns():
    """Verifies that all CacheKeys pattern helpers return valid expected prefixes."""
    assert CacheKeys.hostel_pattern() == f"{CacheKeys.PREFIX}:hostel:*"
    assert CacheKeys.study_room_pattern() == f"{CacheKeys.PREFIX}:study:seats:*"
    assert CacheKeys.academic_batches_pattern() == f"{CacheKeys.PREFIX}:academics:batches:*"
    assert CacheKeys.academic_courses_pattern() == f"{CacheKeys.PREFIX}:academics:courses:*"
    assert CacheKeys.examinations_pattern() == f"{CacheKeys.PREFIX}:examinations:*"
    assert CacheKeys.attendance_pattern() == f"{CacheKeys.PREFIX}:attendance:*"
    assert CacheKeys.student_pattern() == f"{CacheKeys.PREFIX}:students:*"


@pytest.mark.asyncio
async def test_cache_invalidator_invalidate_student():
    """Verifies CacheInvalidator.invalidate_student evicts student profile and dashboard metrics."""
    student_id = uuid.uuid4()
    with patch.object(cache_service, "delete", new_callable=AsyncMock) as mock_delete:
        await CacheInvalidator.invalidate_student(student_id)
        assert mock_delete.call_count == 2
        deleted_keys = [call.args[0] for call in mock_delete.call_args_list]
        assert CacheKeys.student_profile(student_id) in deleted_keys
        assert CacheKeys.dashboard_metrics() in deleted_keys


@pytest.mark.asyncio
async def test_cache_invalidator_invalidate_students_bulk():
    """Verifies CacheInvalidator.invalidate_students evicts multiple student profiles deduplicated."""
    sid1 = uuid.uuid4()
    sid2 = uuid.uuid4()
    with patch.object(cache_service, "delete", new_callable=AsyncMock) as mock_delete:
        await CacheInvalidator.invalidate_students([sid1, sid2, sid1])
        # 2 unique students + 1 dashboard metrics = 3 calls
        assert mock_delete.call_count == 3
        deleted_keys = [call.args[0] for call in mock_delete.call_args_list]
        assert CacheKeys.student_profile(sid1) in deleted_keys
        assert CacheKeys.student_profile(sid2) in deleted_keys
        assert CacheKeys.dashboard_metrics() in deleted_keys


@pytest.mark.asyncio
async def test_cache_invalidator_invalidate_batch_roster():
    """Verifies CacheInvalidator.invalidate_batch_roster evicts batch patterns, dashboard, and students."""
    sid = uuid.uuid4()
    batch_id = uuid.uuid4()
    with patch.object(cache_service, "delete", new_callable=AsyncMock) as mock_delete, \
         patch.object(cache_service, "delete_pattern", new_callable=AsyncMock) as mock_delete_pattern:
        await CacheInvalidator.invalidate_batch_roster(batch_id=batch_id, student_ids=[sid])
        mock_delete_pattern.assert_called_once_with(CacheKeys.academic_batches_pattern())
        assert mock_delete.call_count == 2
        deleted_keys = [call.args[0] for call in mock_delete.call_args_list]
        assert CacheKeys.dashboard_metrics() in deleted_keys
        assert CacheKeys.student_profile(sid) in deleted_keys


@pytest.mark.asyncio
async def test_cache_invalidator_invalidate_facility_capacity():
    """Verifies facility capacity eviction clears hostel, study seats, and dashboard metrics."""
    with patch.object(cache_service, "delete", new_callable=AsyncMock) as mock_delete, \
         patch.object(cache_service, "delete_pattern", new_callable=AsyncMock) as mock_delete_pattern:
        await CacheInvalidator.invalidate_facility_capacity()
        mock_delete.assert_called_once_with(CacheKeys.dashboard_metrics())
        assert mock_delete_pattern.call_count == 2
        patterns = [call.args[0] for call in mock_delete_pattern.call_args_list]
        assert CacheKeys.hostel_pattern() in patterns
        assert CacheKeys.study_room_pattern() in patterns
