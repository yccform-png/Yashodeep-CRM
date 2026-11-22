# Coaching Institute Management ERP - System Architecture

## 1. Executive Overview

The Coaching Institute Management ERP is an enterprise-grade, modular monolithic platform engineered for private coaching academies providing multi-stream secondary/higher-secondary academics, competitive examination coaching (CET, JEE, NEET, Foundation), residential hostel accommodations, and high-capacity study room facilities (150 initial seats: 105 Boys, 45 Girls).

The platform is designed around strict separation of concerns, complete database-driven configurability (no hardcoded fees, subjects, courses, seats, or capacities), comprehensive financial auditability (double-entry allocation, decimal precision, immutable invoices), and zero-trust role-based access control (RBAC).

---

## 2. High-Level Architectural Diagram

```text
+-----------------------------------------------------------------------------------+
|                                Client Applications                                |
|  - React 18+ / Vite / TypeScript / Tailwind CSS / shadcn/ui                       |
|  - Dashboards: Admin, Teacher, Accountant, Hostel Warden, Study Room, Student/Parent|
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTPS / REST JSON (JWT Session Bearer)
                                          v
+-----------------------------------------------------------------------------------+
|                           API Gateway / Reverse Proxy                             |
|                                    (Nginx)                                        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              FastAPI Modular Monolith                             |
|                                                                                   |
|  +-------------------+  +-------------------+  +-------------------+              |
|  | Authentication &  |  |    Academics &    |  |   Admissions &    |              |
|  |  RBAC Middleware  |  |   Course Engine   |  | Enrollment Engine |              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  | Services Engine   |  | Dynamic Fee &     |  | Hostel & Facility |              |
|  | (Tuition/Hostel/SR|  | Invoicing Engine  |  | Allocation Engine |              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  | Study Room 150-St |  | Attendance Engine |  | Exam & Assessment |              |
|  | Visual Allocator  |  | (Acd/Hostel/Study)|  | Engine            |              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  +-------------------+  +-------------------+  +-------------------+              |
|  | Reports & Export  |  | Audit Logger &    |  | Notifications &   |              |
|  | Engine (CSV/PDF)  |  | Security Guards   |  | Outbox Dispatcher |              |
|  +-------------------+  +-------------------+  +-------------------+              |
+--------------------+---------------------+--------------------+-------------------+
                     |                     |                    |
                     v                     v                    v
         +-----------------------+ +----------------+ +------------------+
         |      PostgreSQL       | |  Redis Broker  | |  Celery Workers  |
         | (SQLAlchemy 2.0 Async)| |    & Cache     | | (Async Tasks &   |
         |  UUID, NUMERIC(12,2)  | |                | |  Scheduled Rem.) |
         +-----------------------+ +----------------+ +------------------+
```

---

## 3. Technology Stack & Decision Rationale

### 3.1 Backend
- **Python 3.12+ & FastAPI**: High throughput asynchronous request handling with automatic OpenAPI v3 generation, native Pydantic v2 data validation, and dependency injection.
- **SQLAlchemy 2.0 (Async/Sync hybrid)**: Strict type-safe query formulation, identity map, unit-of-work transactions, and support for complex joins with eager loading (`selectinload`, `joinedload`) to eliminate N+1 query patterns.
- **Alembic**: Explicit, reproducible database migrations versioned alongside source code.
- **PostgreSQL 16+**: ACID relational storage, UUIDv4 primary keys, row-level check constraints, foreign keys with strict cascade controls, and JSONB for audit metadata.
- **Redis & Celery**: Asynchronous processing queue for reminder dispatches, PDF generation, bulk attendance calculations, and webhook processing.

### 3.2 Frontend
- **React 18+ with TypeScript & Vite**: Type-safe component architecture with instant HMR and optimized tree-shaken production bundles.
- **Tailwind CSS & shadcn/ui**: Modern, accessible UI primitives styled with utility classes.
- **TanStack Query (React Query v5)**: Server state synchronization, optimistic updates, cache invalidation, and automatic request deduplication.
- **React Router v6**: Nested route layouts with role-based Route Guards.
- **React Hook Form + Zod**: Controlled, type-inferred dynamic form validation (essential for the multi-step admission wizard).
- **Lucide React & Recharts**: Clean SVG icon system and reactive canvas/SVG data visualization.

---

## 4. Key Subsystem Boundaries

### 4.1 Academics vs. Batches
- **Course**: The curriculum definition (e.g., "11th Science - Regular + CET", containing Subjects: Physics, Chemistry, Mathematics, Biology).
- **Batch**: The physical execution unit (e.g., "11-SCI-A-2026 Morning Batch" meeting in Room 101 with designated faculty for each subject).
- Students can enroll in a full course package or individual subjects, and each subject enrollment maps to corresponding batch schedules.

### 4.2 Services Subsystem
The institute operates three primary service types:
1. `TUITION`: Classroom teaching, notes, and academic tests.
2. `HOSTEL`: Boarding, room, bed, and mess facilities.
3. `STUDY_ROOM`: Dedicated quiet study seat with individual power, desk light, and locker (150 initial seats).

**Rule**: All services are independently subscribable. A student can enroll in Tuition only, Study Room only, Hostel only, or any permutation. Subscriptions define billing frequency (monthly, quarterly, yearly), pricing plan, and active validity date ranges.

### 4.3 Dynamic Pricing & Fee Calculation Engine
- Multi-tier pricing: Course Package vs. Individual Subject Pricing.
- Package inclusion validation prevents double-billing (if a package already contains Mathematics, standalone Mathematics fee is omitted).
- Calculates gross total, mandatory deposits (Hostel/Study Room deposits), applied scholarships/discounts, and generates installment breakdown schedules.
- Financial arithmetic uses `Decimal` / `NUMERIC(12,2)` throughout; no floating-point arithmetic is permitted.

### 4.4 Study Room Grid System
- Dedicated inventory of 150 physical seats:
  - 105 Boys seats (`B001` - `B105`)
  - 45 Girls seats (`G001` - `G045`)
- Visual floor plan renderer representing Real-Time Occupancy:
  - Green: Available
  - Red: Occupied (shows occupant details, roll number, expiration date)
  - Amber: Reserved / Expiring within 7 days
  - Gray: Maintenance / Blocked
- Concurrency protection: `SELECT ... FOR UPDATE` row-level locks on `study_seats` prevent race conditions during simultaneous booking.

---

## 5. Security & RBAC Architecture

1. **Authentication**: JWT access tokens (15-60 min validity) paired with secure HTTP-only refresh tokens, or bearer tokens with server-side session blacklisting.
2. **Password Security**: Password hashing with Argon2id / Bcrypt (work factor 12+).
3. **Role-Based & Object-Level Access Control**:
   - `SUPER_ADMIN / ADMIN`: Unrestricted system oversight and configuration.
   - `TEACHER`: Read access to assigned batches/students; write access to assigned batch attendance and examination marks.
   - `ACCOUNTANT`: Full access to fee structures, invoices, payment recording, and financial ledgers; strictly blocked from altering academic marks or attendance.
   - `HOSTEL_WARDEN`: Building, room, bed management, resident check-in/out, and visitor logs.
   - `STUDY_ROOM_MANAGER`: Seat allocation, renewals, category occupancy management.
   - `STUDENT`: Scoped self-access to enrollment, invoices, payment history, attendance, and published report cards.
   - `PARENT`: Multi-student linked portal with read-only access to their verified children's attendance, fees, and results.
4. **Audit Logging**: Structured audit trail tracking user ID, IP address, action, target entity, timestamp, and JSON delta changes for all sensitive operations (payments, marks alterations, fee discounts).
