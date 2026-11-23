import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_auth_refresh_sliding_session(client: AsyncClient, auth_headers: dict):
    """
    Test that an active user can refresh their token to maintain a sliding session.
    """
    # 1. Unauthenticated refresh should fail with 401
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as unauth_client:
        res_unauth = await unauth_client.post("/api/v1/auth/refresh")
        assert res_unauth.status_code == 401

    # 2. Authenticated refresh should succeed and return fresh token
    res = await client.post("/api/v1/auth/refresh", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["email"] == settings.FIRST_SUPERUSER_EMAIL
    assert "SUPER_ADMIN" in data["roles"]

    new_token = data["access_token"]
    assert new_token != ""

    # 3. Use new refreshed token to access /auth/me
    new_headers = {"Authorization": f"Bearer {new_token}"}
    res_me = await client.get("/api/v1/auth/me", headers=new_headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == settings.FIRST_SUPERUSER_EMAIL
