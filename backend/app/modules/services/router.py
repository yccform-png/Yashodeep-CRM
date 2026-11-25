import uuid
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.exceptions import NotFoundException
from app.core.cache import cache_service, CacheKeys
from app.models.user import User
from app.models.service import ServiceType, ServicePlan, StudentService

router = APIRouter(prefix="/services", tags=["Services"])


class ServiceTypeResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ServicePlanCreate(BaseModel):
    service_type_id: uuid.UUID
    name: str
    code: str
    billing_frequency: str = "YEARLY"  # ONE_TIME, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY
    base_amount: Decimal
    deposit_amount: Decimal = Decimal("0.00")
    features: Optional[dict] = {}


class ServicePlanUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    billing_frequency: Optional[str] = None
    base_amount: Optional[Decimal] = None
    deposit_amount: Optional[Decimal] = None
    features: Optional[dict] = None
    is_active: Optional[bool] = None


class ServicePlanResponse(BaseModel):
    id: uuid.UUID
    service_type_id: uuid.UUID
    name: str
    code: str
    billing_frequency: str
    base_amount: Decimal
    deposit_amount: Decimal
    features: dict
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/types", response_model=List[ServiceTypeResponse])
async def list_service_types(db: AsyncSession = Depends(get_db)):
    cached = await cache_service.get(CacheKeys.service_types())
    if cached is not None:
        return cached

    result = await db.execute(select(ServiceType).where(ServiceType.is_active.is_(True)))
    items = result.scalars().all()
    serialized = [ServiceTypeResponse.model_validate(item).model_dump() for item in items]
    await cache_service.set(CacheKeys.service_types(), serialized, ttl=1800)
    return items


@router.get("/plans", response_model=List[ServicePlanResponse])
async def list_service_plans(
    service_type_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    cache_key = CacheKeys.service_plans(service_type_code)
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    stmt = select(ServicePlan).join(ServiceType).where(ServicePlan.is_active.is_(True))
    if service_type_code:
        stmt = stmt.where(ServiceType.code == service_type_code)
    result = await db.execute(stmt)
    items = result.scalars().all()
    serialized = [ServicePlanResponse.model_validate(p).model_dump() for p in items]
    await cache_service.set(cache_key, serialized, ttl=1800)
    return items


@router.post("/plans", response_model=ServicePlanResponse, status_code=status.HTTP_201_CREATED)
async def create_service_plan(
    data: ServicePlanCreate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    plan = ServicePlan(
        service_type_id=data.service_type_id,
        name=data.name,
        code=data.code,
        billing_frequency=data.billing_frequency,
        base_amount=data.base_amount,
        deposit_amount=data.deposit_amount,
        features=data.features or {},
        is_active=True
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    await cache_service.delete_pattern(CacheKeys.service_plans_pattern())
    return plan


@router.put("/plans/{plan_id}", response_model=ServicePlanResponse)
async def update_service_plan(
    plan_id: uuid.UUID,
    data: ServicePlanUpdate,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    plan = await db.get(ServicePlan, plan_id)
    if not plan:
        raise NotFoundException(f"Service plan {plan_id} not found")

    if data.name is not None:
        plan.name = data.name
    if data.code is not None:
        plan.code = data.code
    if data.billing_frequency is not None:
        plan.billing_frequency = data.billing_frequency
    if data.base_amount is not None:
        plan.base_amount = data.base_amount
    if data.deposit_amount is not None:
        plan.deposit_amount = data.deposit_amount
    if data.features is not None:
        plan.features = data.features
    if data.is_active is not None:
        plan.is_active = data.is_active

    await db.commit()
    await db.refresh(plan)
    await cache_service.delete_pattern(CacheKeys.service_plans_pattern())
    return plan


@router.delete("/plans/{plan_id}")
async def delete_service_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(require_role(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    plan = await db.get(ServicePlan, plan_id)
    if not plan:
        raise NotFoundException(f"Service plan {plan_id} not found")

    plan.is_active = False
    await db.commit()
    await cache_service.delete_pattern(CacheKeys.service_plans_pattern())
    return {"message": f"Service plan '{plan.name}' deactivated successfully", "status": "DEACTIVATED"}
