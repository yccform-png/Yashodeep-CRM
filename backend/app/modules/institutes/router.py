import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.institute import Institute
from app.modules.institutes.schemas import InstituteResponse, InstituteUpdate

router = APIRouter(prefix="/institutes", tags=["Institutes & Settings"])


@router.get("/profile", response_model=InstituteResponse)
async def get_institute_profile(
    db: AsyncSession = Depends(get_db)
):
    """
    Returns active institute letterhead and branding profile.
    Used across UI navigation, dual-copy invoices, and payment receipts.
    Cached for 3600 seconds with write-invalidation.
    """
    cached = await cache_service.get(CacheKeys.institute_profile())
    if cached:
        return cached

    stmt = select(Institute).where(Institute.is_active == True).order_by(Institute.created_at.asc())
    institute = (await db.execute(stmt)).scalars().first()
    if not institute:
        raise NotFoundException("Institute configuration not found")

    data_dict = InstituteResponse.model_validate(institute).model_dump()
    await cache_service.set(CacheKeys.institute_profile(), data_dict, ttl=3600)
    return institute


@router.put("/profile", response_model=InstituteResponse)
async def update_institute_profile(
    data: InstituteUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN", "ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the master institute branding, registration, campus address,
    contact numbers, bank/UPI coordinates, and authorized signatory.
    Purges cached profile on commit.
    """
    stmt = select(Institute).order_by(Institute.created_at.asc())
    if current_user.institute_id:
        stmt = select(Institute).where(Institute.id == current_user.institute_id)

    institute = (await db.execute(stmt)).scalars().first()
    if not institute:
        raise NotFoundException("Institute record not found")

    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        if value is not None:
            setattr(institute, key, value)

    await db.commit()
    await db.refresh(institute)
    await cache_service.delete(CacheKeys.institute_profile())
    return institute
