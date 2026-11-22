# Coaching Institute Management ERP

A production-ready, enterprise-grade Coaching Institute Management ERP platform engineered for private coaching academies providing multi-tier academics (5th-12th Science & Commerce, CET, competitive exams), dynamic fee structures, residential hostel facilities, and high-capacity study room allocations (150 initial seats: 105 boys, 45 girls).

---

## Key Features

1. **Academic & Course Engine**: Completely configurable classes (5th-12th), streams (Science, Commerce), courses (Regular, CET, Integrated), subjects, subject bundles (PCM, PCB, PCMB), and individual subject enrollments without code changes.
2. **Unified Student Profile**: Single source of truth holding academic enrollments, service subscriptions, hostel and study room allocations, billing, attendance, and exam report cards.
3. **Combined Multi-Year Admissions**: Full support for 11th + 12th combined two-year admissions with academic year isolation and promotion workflows.
4. **Independent Service Subscriptions**: Tuition, Hostel, and Study Room can be subscribed independently in any permutation.
5. **Dynamic Fee Calculation & Double-Charge Prevention**: Package pricing vs. individual pricing with smart deductions when a bundle covers selected subjects.
6. **Study Room Visual Seat Allocator**: 150-seat inventory (105 boys `B001`-`B105`, 45 girls `G001`-`G045`) with interactive seating visualizer, category-based pricing, and concurrency locking.
7. **Complete Hostel Management**: Full hierarchy (Hostel -> Building -> Floor -> Room -> Bed), check-in/check-out, visitor registry, and incident management.
8. **Multi-Domain Attendance & Exams**: Distinct attendance domains (Academic, Hostel, Study Room) and flexible exam marks calculation with negative marking and grade reports.
9. **Role-Based Portals**: Tailored interfaces for Admin, Teacher, Accountant, Hostel Warden, Study Room Manager, Student, and Parent.

---

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL, Alembic, Redis, Celery.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Recharts, Lucide React.
- **Infrastructure**: Docker, Docker Compose, Nginx.

---

## Quick Start (Development)

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Run Database & Redis Services
```bash
docker-compose up -d postgres redis
```

### 3. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.initial_data  # Seeds admin user, master academic data, and 150 study seats
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Visit the application at `http://localhost:5173`.
Access API documentation at `http://localhost:8000/api/v1/docs`.
