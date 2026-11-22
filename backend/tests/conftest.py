import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.security import create_access_token
from app.core.database import SyncSessionLocal, get_db
from app.models.user import User
from app.main import app

# Use NullPool for tests so asyncpg connections are never reused across different asyncio loops
test_engine = create_async_engine(settings.async_database_url, poolclass=NullPool)
TestAsyncSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
def auth_headers() -> dict:
    db = SyncSessionLocal()
    try:
        admin = db.query(User).filter_by(email=settings.FIRST_SUPERUSER_EMAIL).first()
        admin_id = str(admin.id) if admin else "7897d623-6b15-4f13-9088-686690edb7bc"
    finally:
        db.close()

    token = create_access_token(
        subject=admin_id,
        extra_claims={
            "email": settings.FIRST_SUPERUSER_EMAIL,
            "user_type": "SUPER_ADMIN",
            "roles": ["SUPER_ADMIN", "ADMIN"]
        }
    )
    return {"Authorization": f"Bearer {token}"}


def pytest_sessionfinish(session, exitstatus):
    """
    Automatic teardown hook:
    Strictly guards live production databases.
    Only permitted in an isolated test environment.
    """
    db_url = str(settings.DATABASE_URL or "")
    if "neon.tech" in db_url or "aws" in db_url or settings.ENVIRONMENT != "test":
        print("\n>>> Protected Database detected: Skipping automatic test purge to preserve all existing records.")
        return

    import asyncio
    from scripts.cleanup_test_data import clean_database
    try:
        asyncio.run(clean_database())
    except Exception as e:
        print(f"Warning: Automatic test data cleanup failed: {e}")

