from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.exceptions import DomainException
from app.modules.authentication.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.academics.router import router as academics_router
from app.modules.students.router import router as students_router
from app.modules.enrollments.router import router as enrollments_router
from app.modules.services.router import router as services_router
from app.modules.fees.router import router as fees_router
from app.modules.study_room.router import router as study_room_router
from app.modules.hostel.router import router as hostel_router
from app.modules.attendance.router import router as attendance_router
from app.modules.examinations.router import router as examinations_router
from app.modules.reports.router import router as reports_router
from app.modules.institutes.router import router as institutes_router
from app.modules.notifications.router import router as notifications_router
from app.core.cache import cache_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions: Initialize Redis connection pool
    await cache_service.init_pool()
    yield
    # Shutdown actions: Close Redis connection pool
    await cache_service.close_pool()


app = FastAPI(
    title="Coaching Institute Management ERP API",
    description="Comprehensive Institute Management Platform API for Academics, Flexible Course Enrollment, Facilities, Dynamic Fees, Invoices, Attendance, Examinations, and Role-Based Portals.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Vite dev and configured production domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Exception handler for domain errors
@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.message, "code": exc.code}
    )


# Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "HEALTHY",
        "service": "institute-management-erp-backend",
        "environment": settings.ENVIRONMENT
    }


# Include all Version 1 API routers
api_v1_prefix = "/api/v1"
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(users_router, prefix=api_v1_prefix)
app.include_router(academics_router, prefix=api_v1_prefix)
app.include_router(students_router, prefix=api_v1_prefix)
app.include_router(enrollments_router, prefix=api_v1_prefix)
app.include_router(services_router, prefix=api_v1_prefix)
app.include_router(fees_router, prefix=api_v1_prefix)
app.include_router(study_room_router, prefix=api_v1_prefix)
app.include_router(hostel_router, prefix=api_v1_prefix)
app.include_router(attendance_router, prefix=api_v1_prefix)
app.include_router(examinations_router, prefix=api_v1_prefix)
app.include_router(reports_router, prefix=api_v1_prefix)
app.include_router(institutes_router, prefix=api_v1_prefix)
app.include_router(notifications_router, prefix=api_v1_prefix)
