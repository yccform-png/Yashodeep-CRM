"""
backend/app/core/cache.py
Centralized, Async, Production-Grade Redis Caching Service for Yashodeep Coaching Classes ERP.
Implements the Cache-Aside pattern, connection pooling, non-blocking scan invalidation,
custom serialization for domain types (UUID, Decimal, Date, DateTime), and fail-open resilience.
"""
import json
import logging
import uuid
import asyncio
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional, List, Sequence, Union
import redis.asyncio as aioredis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger("ycc.cache")


class CustomJSONEncoder(json.JSONEncoder):
    """
    Serializes custom domain types into JSON-compatible primitives for Redis storage:
    - UUID -> string
    - datetime / date / time -> ISO format string
    - Decimal -> float
    - Pydantic models -> dict
    """
    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date, time)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "__dict__"):
            return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
        return super().default(obj)


class CacheService:
    """
    Asynchronous Redis cache service with connection pooling, multi-event-loop resilience,
    and fail-open database fallback.
    """
    def __init__(self):
        self.pool: Optional[aioredis.ConnectionPool] = None
        self.client: Optional[aioredis.Redis] = None
        self.is_connected: bool = False
        self._loop = None

    async def _ensure_connection(self) -> bool:
        """
        Ensures a live connection pool exists for the currently running asyncio event loop.
        Seamlessly handles multi-loop test harnesses (e.g. pytest-asyncio) and long-lived server loops.
        """
        if not settings.REDIS_CACHE_ENABLED:
            return False

        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self.client and self.is_connected and self._loop == current_loop:
            return True

        self._loop = current_loop
        try:
            self.client = aioredis.from_url(
                settings.REDIS_URL,
                max_connections=50,
                socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
                socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                decode_responses=True,
                encoding="utf-8"
            )
            self.pool = self.client.connection_pool
            await self.client.ping()
            self.is_connected = True
            return True
        except Exception as exc:
            self.is_connected = False
            self.client = None
            self.pool = None
            logger.warning(
                f"Redis connection failed at {settings.REDIS_URL}: {exc}. "
                "Operating in fail-open fallback mode."
            )
            return False

    async def init_pool(self) -> None:
        """
        Initializes the Redis connection pool during FastAPI application startup.
        If Redis is unreachable, fail-open mode is activated without crashing the application.
        """
        await self._ensure_connection()

    async def close_pool(self) -> None:
        """
        Gracefully tears down Redis connection pool during FastAPI shutdown.
        """
        if self.client:
            try:
                await self.client.aclose()
            except Exception as exc:
                logger.warning(f"Error while closing Redis client: {exc}")
        if self.pool:
            try:
                await self.pool.disconnect()
            except Exception as exc:
                logger.warning(f"Error while closing Redis pool: {exc}")
        self.is_connected = False
        self.client = None
        self.pool = None
        self._loop = None
        logger.info("Redis cache connection pool closed.")

    async def get(self, key: str) -> Optional[Any]:
        """
        Fetches and deserializes a cached value by key.
        Returns None on cache miss, connection error, or disabled cache (fail-open).
        """
        if not await self._ensure_connection():
            return None

        try:
            val = await self.client.get(key)
            if val is not None:
                return json.loads(val)
            return None
        except Exception as exc:
            logger.warning(f"Redis GET failed for key '{key}': {exc}. Falling back to DB.")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Serializes and stores a value in Redis with an optional TTL in seconds.
        Uses REDIS_DEFAULT_TTL if ttl is not specified.
        Returns True on success, False on error (fail-open).
        """
        if not await self._ensure_connection():
            return False

        effective_ttl = ttl if ttl is not None else settings.REDIS_DEFAULT_TTL
        try:
            payload = json.dumps(value, cls=CustomJSONEncoder)
            await self.client.set(key, payload, ex=effective_ttl)
            return True
        except Exception as exc:
            logger.warning(f"Redis SET failed for key '{key}': {exc}.")
            return False

    async def delete(self, key: str) -> bool:
        """
        Deletes a specific cache key.
        """
        if not await self._ensure_connection():
            return False

        try:
            await self.client.delete(key)
            return True
        except Exception as exc:
            logger.warning(f"Redis DELETE failed for key '{key}': {exc}.")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """
        Safely scans and removes all keys matching the wildcard pattern using SCAN.
        Never uses blocking KEYS command in production.
        """
        if not await self._ensure_connection():
            return 0

        deleted_count = 0
        try:
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await self.client.delete(*keys)
                    deleted_count += len(keys)
                if cursor == 0:
                    break
            return deleted_count
        except Exception as exc:
            logger.warning(f"Redis SCAN DELETE failed for pattern '{pattern}': {exc}.")
            return deleted_count

    async def flush_all(self) -> bool:
        """
        Flushes the current Redis database. Used primarily in test suites.
        """
        if not await self._ensure_connection():
            return False
        try:
            await self.client.flushdb()
            return True
        except Exception as exc:
            logger.warning(f"Redis flush failed: {exc}")
            return False


# Global singleton instance
cache_service = CacheService()


# Cache Key Namespace Helpers
class CacheKeys:
    """Standardized deterministic cache key generators for Yashodeep Coaching Classes ERP."""
    PREFIX = "ycc:v1"

    @classmethod
    def institute_profile(cls) -> str:
        return f"{cls.PREFIX}:inst:profile"

    @classmethod
    def dashboard_metrics(cls) -> str:
        return f"{cls.PREFIX}:reports:dashboard"

    @classmethod
    def academic_years(cls) -> str:
        return f"{cls.PREFIX}:academics:years:all"

    @classmethod
    def academic_classes(cls) -> str:
        return f"{cls.PREFIX}:academics:classes:all"

    @classmethod
    def academic_streams(cls) -> str:
        return f"{cls.PREFIX}:academics:streams:all"

    @classmethod
    def academic_subjects(cls) -> str:
        return f"{cls.PREFIX}:academics:subjects:all"

    @classmethod
    def academic_courses(cls) -> str:
        return f"{cls.PREFIX}:academics:courses:all"

    @classmethod
    def academic_batches(cls) -> str:
        return f"{cls.PREFIX}:academics:batches:all"

    @classmethod
    def academic_batches_pattern(cls) -> str:
        return f"{cls.PREFIX}:academics:batches:*"

    @classmethod
    def academic_courses_pattern(cls) -> str:
        return f"{cls.PREFIX}:academics:courses:*"

    @classmethod
    def academic_pattern(cls) -> str:
        return f"{cls.PREFIX}:academics:*"

    @classmethod
    def service_types(cls) -> str:
        return f"{cls.PREFIX}:services:types:all"

    @classmethod
    def service_plans(cls, type_code: Optional[str] = None) -> str:
        if type_code:
            return f"{cls.PREFIX}:services:plans:type:{type_code}"
        return f"{cls.PREFIX}:services:plans:all"

    @classmethod
    def service_plans_pattern(cls) -> str:
        return f"{cls.PREFIX}:services:*"

    @classmethod
    def study_room_seats(cls, gender: Optional[str] = None, status: Optional[str] = None) -> str:
        g = gender or "any"
        s = status or "any"
        return f"{cls.PREFIX}:study:seats:{g}:{s}"

    @classmethod
    def study_room_pattern(cls) -> str:
        return f"{cls.PREFIX}:study:seats:*"

    @classmethod
    def hostel_tree(cls) -> str:
        return f"{cls.PREFIX}:hostel:tree:all"

    @classmethod
    def hostel_pattern(cls) -> str:
        return f"{cls.PREFIX}:hostel:*"

    @classmethod
    def student_profile(cls, student_id: Any) -> str:
        return f"{cls.PREFIX}:students:profile:{student_id}"

    @classmethod
    def student_pattern(cls, student_id: Optional[Any] = None) -> str:
        if student_id:
            return f"{cls.PREFIX}:students:profile:{student_id}"
        return f"{cls.PREFIX}:students:*"

    @classmethod
    def examinations_pattern(cls) -> str:
        return f"{cls.PREFIX}:examinations:*"

    @classmethod
    def attendance_pattern(cls) -> str:
        return f"{cls.PREFIX}:attendance:*"


class CacheInvalidator:
    """Centralized atomic cache invalidation workflows across domains."""

    @staticmethod
    async def invalidate_students(student_ids: Sequence[Any]) -> None:
        """Invalidates cached profile keys for one or more students, plus dashboard KPIs."""
        if not student_ids:
            return
        unique_ids = {str(sid) for sid in student_ids if sid}
        for sid in unique_ids:
            await cache_service.delete(CacheKeys.student_profile(sid))
        await cache_service.delete(CacheKeys.dashboard_metrics())

    @staticmethod
    async def invalidate_student(student_id: Any) -> None:
        """Invalidates cached profile for a single student, plus dashboard metrics."""
        if not student_id:
            return
        await cache_service.delete(CacheKeys.student_profile(student_id))
        await cache_service.delete(CacheKeys.dashboard_metrics())

    @staticmethod
    async def invalidate_batch_roster(batch_id: Optional[Any] = None, student_ids: Optional[Sequence[Any]] = None) -> None:
        """Invalidates batch listings and affected students' profiles."""
        await cache_service.delete_pattern(CacheKeys.academic_batches_pattern())
        await cache_service.delete(CacheKeys.dashboard_metrics())
        if student_ids:
            for sid in set(student_ids):
                if sid:
                    await cache_service.delete(CacheKeys.student_profile(sid))

    @staticmethod
    async def invalidate_facility_capacity() -> None:
        """Invalidates hostel tree, study room seats, and dashboard capacity KPIs."""
        await cache_service.delete_pattern(CacheKeys.hostel_pattern())
        await cache_service.delete_pattern(CacheKeys.study_room_pattern())
        await cache_service.delete(CacheKeys.dashboard_metrics())

