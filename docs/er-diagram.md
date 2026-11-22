# Coaching Institute Management ERP - Entity Relationship Diagrams

## 1. Core Master Architecture & Security

```mermaid
erDiagram
    INSTITUTES ||--o{ USERS : "employs / serves"
    INSTITUTES ||--o{ INSTITUTES_SETTINGS : "configures"
    USERS ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ USER_ROLES : "assigned"
    ROLES ||--o{ ROLE_PERMISSIONS : "grants"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "granted"
    USERS ||--o{ AUDIT_LOGS : "triggers"
    USERS ||--o| STUDENTS : "owns account"
    USERS ||--o| GUARDIANS : "owns account"
    USERS ||--o| TEACHERS : "staff profile"
```

---

## 2. Academic Curriculum, Batches & Timetable

```mermaid
erDiagram
    ACADEMIC_YEARS ||--o{ ENROLLMENTS : "scopes"
    CLASSES ||--o{ COURSES : "targets"
    STREAMS ||--o{ COURSES : "specifies"
    COURSES ||--o{ COURSE_VERSIONS : "versions"
    COURSE_VERSIONS ||--o{ COURSE_VERSION_SUBJECTS : "comprises"
    SUBJECTS ||--o{ COURSE_VERSION_SUBJECTS : "included in"
    SUBJECT_GROUPS ||--o{ SUBJECT_GROUP_ITEMS : "contains"
    SUBJECTS ||--o{ SUBJECT_GROUP_ITEMS : "grouped into"
    COURSES ||--o{ BATCHES : "instantiates"
    BATCHES ||--o{ BATCH_SUBJECTS : "schedules"
    SUBJECTS ||--o{ BATCH_SUBJECTS : "taught in"
    TEACHERS ||--o{ BATCH_SUBJECTS : "instructs"
    BATCH_SUBJECTS ||--o{ TIMETABLE_ENTRIES : "scheduled on"
    BATCH_SUBJECTS ||--o{ ATTENDANCE_SESSIONS : "conducts"
    BATCHES ||--o{ BATCH_STUDENTS : "enrolls"
    STUDENTS ||--o{ BATCH_STUDENTS : "assigned to"
```

---

## 3. Student Admissions, Enrollment & Services

```mermaid
erDiagram
    STUDENTS ||--o{ STUDENT_GUARDIANS : "has"
    GUARDIANS ||--o{ STUDENT_GUARDIANS : "supervises"
    STUDENTS ||--o{ STUDENT_DOCUMENTS : "submits"
    ENROLLMENT_GROUPS ||--o{ ENROLLMENTS : "links (multi-year)"
    STUDENTS ||--o{ ENROLLMENTS : "undertakes"
    ENROLLMENTS ||--o{ ENROLLMENT_SUBJECTS : "takes"
    SUBJECTS ||--o{ ENROLLMENT_SUBJECTS : "enrolled in"
    SERVICE_TYPES ||--o{ SERVICE_PLANS : "offers"
    SERVICE_PLANS ||--o{ STUDENT_SERVICES : "subscribes"
    STUDENTS ||--o{ STUDENT_SERVICES : "holds active"
```

---

## 4. Financial Engine: Invoices, Installments & Payments

```mermaid
erDiagram
    STUDENTS ||--o{ INVOICES : "billed to"
    ENROLLMENTS ||--o{ INVOICES : "originates from"
    INVOICES ||--o{ INVOICE_ITEMS : "contains"
    INVOICES ||--o| INSTALLMENT_PLANS : "scheduled by"
    INSTALLMENT_PLANS ||--o{ INSTALLMENTS : "breaks down into"
    STUDENTS ||--o{ PAYMENTS : "remits"
    PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : "allocates"
    INVOICES ||--o{ PAYMENT_ALLOCATIONS : "settled by"
    INSTALLMENTS ||--o{ PAYMENT_ALLOCATIONS : "clears"
    PAYMENTS ||--o| RECEIPTS : "generates"
    PAYMENTS ||--o{ REFUNDS : "reverses"
```

---

## 5. Physical Facilities: Study Room (150 Seats) & Hostel

```mermaid
erDiagram
    STUDY_ROOMS ||--o{ STUDY_SEATS : "contains"
    STUDY_ROOM_CATEGORIES ||--o{ STUDY_SEATS : "categorizes"
    STUDY_SEATS ||--o{ SEAT_ALLOCATIONS : "leased via"
    STUDENTS ||--o{ SEAT_ALLOCATIONS : "occupies"
    STUDENT_SERVICES ||--o{ SEAT_ALLOCATIONS : "authorizes"
    STUDY_SEATS ||--o{ STUDY_ROOM_ATTENDANCE : "logged in"

    HOSTELS ||--o{ HOSTEL_BUILDINGS : "contains"
    HOSTEL_BUILDINGS ||--o{ HOSTEL_FLOORS : "has"
    HOSTEL_FLOORS ||--o{ HOSTEL_ROOMS : "divides into"
    HOSTEL_ROOMS ||--o{ HOSTEL_BEDS : "houses"
    HOSTEL_BEDS ||--o{ BED_ALLOCATIONS : "tenanted via"
    STUDENTS ||--o{ BED_ALLOCATIONS : "resides in"
    STUDENT_SERVICES ||--o{ BED_ALLOCATIONS : "authorizes"
    HOSTEL_ROOMS ||--o{ HOSTEL_MAINTENANCE : "experiences"
    STUDENTS ||--o{ HOSTEL_VISITORS : "visited by"
```

---

## 6. Attendance & Assessment Engine

```mermaid
erDiagram
    ATTENDANCE_SESSIONS ||--o{ ATTENDANCE_RECORDS : "records"
    STUDENTS ||--o{ ATTENDANCE_RECORDS : "attended by"
    ATTENDANCE_RECORDS ||--o{ ATTENDANCE_CORRECTIONS : "audited by"

    EXAM_TYPES ||--o{ EXAMINATIONS : "categorizes"
    EXAMINATIONS ||--o{ EXAM_SUBJECTS : "tests"
    SUBJECTS ||--o{ EXAM_SUBJECTS : "evaluated"
    EXAM_SUBJECTS ||--o{ EXAM_MARKS : "scores"
    STUDENTS ||--o{ EXAM_MARKS : "earns"
    EXAMINATIONS ||--o{ EXAM_RESULTS : "computes"
    STUDENTS ||--o{ EXAM_RESULTS : "achieves"
```
