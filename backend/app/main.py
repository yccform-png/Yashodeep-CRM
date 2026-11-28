from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
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
from app.modules.expenses.router import router as expenses_router
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
origins = list(set([
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://yashodeep-crm.vercel.app",
    "https://yashodeepcoachingclasses.in",
    "https://www.yashodeepcoachingclasses.in",
    *settings.BACKEND_CORS_ORIGINS
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
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


# Public Meta / WhatsApp Compliance Endpoints
@app.get("/privacy", response_class=HTMLResponse, include_in_schema=False)
async def privacy_policy():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Privacy Policy - Yashodeep Coaching Classes</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:760px;margin:40px auto;line-height:1.6;padding:0 24px;color:#1e293b;}</style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p><strong>Effective Date:</strong> November 2026</p>
  <p>Yashodeep Coaching Classes operates the Institute Management ERP platform and sends automated academic notifications via official channels including the Meta WhatsApp Business Cloud API.</p>
  <h2>Information We Collect</h2>
  <p>We process student and parent contact numbers, full names, and academic records (such as attendance, fee status, and exam grades) provided upon admission.</p>
  <h2>How We Use Information</h2>
  <p>Information is strictly utilized for direct academic communications: attendance absence alerts, fee receipts, installment reminders, and examination results.</p>
  <h2>Data Protection & Sharing</h2>
  <p>We do not sell, rent, or distribute personal information to third parties or marketing brokers. Data is processed securely in compliance with applicable standards.</p>
  <h2>Contact Us</h2>
  <p>If you have any questions or data inquiries, contact us at: <a href="mailto:info@yashodeepcoachingclasses.in">info@yashodeepcoachingclasses.in</a></p>
</body>
</html>"""


@app.get("/terms", response_class=HTMLResponse, include_in_schema=False)
async def terms_of_service():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Terms of Service - Yashodeep Coaching Classes</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:760px;margin:40px auto;line-height:1.6;padding:0 24px;color:#1e293b;}</style>
</head>
<body>
  <h1>Terms of Service</h1>
  <p><strong>Effective Date:</strong> November 2026</p>
  <p>By enrolling at Yashodeep Coaching Classes or receiving institutional alerts, you agree to receive automated communications related to courses, student attendance, fees, and examination announcements.</p>
  <h2>Opting Out</h2>
  <p>To update notification preferences or unsubscribe from automated SMS/WhatsApp alerts, parents may contact the front desk at our campus in Kuditre, Kolhapur.</p>
</body>
</html>"""


@app.get("/data-deletion", response_class=HTMLResponse, include_in_schema=False)
async def data_deletion_instructions():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Data Deletion Instructions - Yashodeep Coaching Classes</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:760px;margin:40px auto;line-height:1.6;padding:0 24px;color:#1e293b;}</style>
</head>
<body>
  <h1>User Data Deletion Instructions</h1>
  <p>In accordance with Meta Platform policies, users have the right to request deletion of their contact information and communication logs.</p>
  <p>To request data deletion:</p>
  <ol>
    <li>Send an email to <a href="mailto:info@yashodeepcoachingclasses.in">info@yashodeepcoachingclasses.in</a> with the subject line <code>Data Deletion Request</code>.</li>
    <li>Include your student registration number (PRN) and the registered WhatsApp mobile number.</li>
    <li>Our administrative team will purge non-regulatory notification logs within 48 hours and send confirmation.</li>
  </ol>
</body>
</html>"""


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
app.include_router(expenses_router, prefix=api_v1_prefix)
