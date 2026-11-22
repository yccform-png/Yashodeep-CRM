# Coaching Institute Management ERP - Business Rules & Invariants

## 1. Zero-Hardcoding Invariant
1. All academic entities (Classes 5th-12th, Streams Science/Commerce, Course Types, Subjects, Subject Groups) must be loaded dynamically from database tables. No hardcoded enums or branching logic for specific classes or subjects.
2. All pricing rules, fee components, service plans, room capacities, seat numbering patterns, and billing frequencies are configured in PostgreSQL.

---

## 2. Academics & Course Bundling Rules

### 2.1 Course vs. Batch
- A **Course** models the educational syllabus (e.g., "11th Science - Regular + CET").
- A **Batch** is an operational schedule (e.g., "Batch A Morning 2026-27"). A course can have zero, one, or multiple batches.
- Students enroll in a course (or specific subjects) and are assigned to corresponding subject-level batches.

### 2.2 Course Versions
- Modifying fees, subjects, or syllabus of an existing course generates a new `course_version`.
- Historical enrollments retain reference to the original `course_version_id` under which the student was admitted, guaranteeing historical academic and fee fidelity.

### 2.3 Individual vs. Package Enrollment
- A student may enroll in:
  1. A complete predefined Subject Group (e.g., PCM or PCMB) or Course Package.
  2. Individual subjects (e.g., 11th Commerce - only Mathematics).
  3. A combination (e.g., PCM Package + CET Course).

---

## 3. Admission & Combined Enrollment Workflows

### 3.1 Single-Year Admission (Standard)
1. Register student master record.
2. Link or create guardian records.
3. Select academic year, class, stream, course, and subjects.
4. Select optional facilities (Hostel and/or Study Room).
5. Invoke Fee Calculation Engine -> Returns Fee Preview.
6. Confirm Admission: executes transactional commit:
   - Creates `enrollments` & `enrollment_subjects`.
   - Creates `student_services` records for active services.
   - Generates initial `invoices` and `installment_plans`.
   - Generates human-readable student code (e.g. `STU-2026-00001`).

### 3.2 Combined Multi-Year Admission (11th + 12th)
- When a student enrolls in a 2-year combined program:
  1. A parent `enrollment_groups` record is created (type: `COMBINED_MULTI_YEAR`).
  2. Two linked `enrollments` are provisioned:
     - Year 1 (11th Science, Status: `ACTIVE`)
     - Year 2 (12th Science, Status: `PROVISIONAL` / `UPCOMING`)
  3. Fee structure can be configured as either:
     - Single combined package with multi-year installment schedule.
     - Two distinct annual fee obligations linked to the respective academic years.
  4. At the end of Year 1, the Promotion Engine transitions Year 1 to `COMPLETED` and Year 2 to `ACTIVE` without destroying or overwriting Year 1 marks, attendance, or financial records.

---

## 4. Pricing & Dynamic Fee Calculation Engine

### 4.1 Input Parameters
- Student ID & Category
- Academic Year, Class, Stream, Course Version
- Enrolled Subject IDs
- Additional Services (Hostel Plan ID, Study Room Plan ID)
- Billing Frequencies
- Approved Discounts / Scholarship IDs

### 4.2 Calculation Steps & Double-Charge Prevention
1. **Base Package Fee**: If a student selects a package (e.g., PCMB package @ ₹35,000), identify the subjects covered by that package (Physics, Chemistry, Maths, Biology).
2. **Additional Subjects**: Any chosen subject *not* covered by the base package is billed at its individual subject rate. If a student chooses Mathematics and PCMB, the system suppresses the standalone Mathematics fee.
3. **Competitive Coaching Addons**: If regular course + CET is selected, add CET tuition component.
4. **Service Charges**:
   - Hostel: Monthly/Term rate x selected billing period + Security Deposit.
   - Study Room: Rate based on room category (e.g. AC vs Non-AC) x billing frequency + Deposit.
5. **Admission & Misc Fees**: One-time admission registration fee if applicable.
6. **Discounts & Concessions**: Apply valid percentage or flat discount to eligible tuition components.
7. **Installment Generation**: Compute due dates and amounts based on the selected installment plan (e.g., 2, 4, or 10 installments).

### 4.3 Invariance & Immutability
- Invoices are immutable once issued. Subsequent adjustments require credit notes or formal revisions.
- Payments must be idempotent. Webhook or front-end retries with the same `transaction_reference` or `gateway_payment_id` do not create duplicate payment records.

---

## 5. Physical Facility Invariants

### 5.1 Study Room (150 Seats)
- Initial inventory: 105 Boys (`B001`-`B105`) and 45 Girls (`G001`-`G045`).
- Gender constraint: Male students cannot be allocated female seats (`G001`-`G045`) and female students cannot be allocated male seats (`B001`-`B105`) unless seat category is set to `ANY`.
- Allocation prerequisite: Requires an `ACTIVE` study room service subscription covering the allocation date range.
- Concurrency guarantee: Seat allocation query uses row locks (`FOR UPDATE`) to prevent double-booking.
- Status states: `AVAILABLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`.

### 5.2 Hostel Management
- Hierarchy: `Hostel -> Building -> Floor -> Room -> Bed`.
- Gender segregation: Hostels are strictly designated Boys or Girls.
- Bed allocation prerequisite: Requires an `ACTIVE` hostel service subscription.
- No overlapping bed occupancy: A bed cannot have two active allocations with overlapping `[start_date, end_date]`.
- Check-in and check-out tracking with recorded inventory and condition notes.

---

## 6. Attendance & Assessment Invariants

### 6.1 Attendance
- Teachers can create sessions and record attendance only for batches assigned to them in `batch_subjects`.
- Duplicate attendance for the same student in the same session is prevented via unique constraint `(session_id, student_id)`.
- Corrections require audit log reason and supervisor tracking.

### 6.2 Examinations & Marks
- Marks can only be entered for students currently enrolled in the corresponding subject and batch.
- Negative marking calculation: $\text{Total} = \text{Correct} \times \text{Weight} - \text{Incorrect} \times \text{NegativeWeight}$.
- Marks are drafts until officially submitted and published by authorized admin/academic head.
- Published results cannot be altered without an official re-evaluation workflow.

---

## 7. Role-Based Access Control (RBAC) Matrix

| Module / Operation | Admin | Teacher | Accountant | Hostel Warden | Study Room Mgr | Student | Parent |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Academic Master Config | RW | R | - | - | - | - | - |
| Admissions & Enrollments | RW | R | R | R | R | Self (R) | Child (R) |
| Fee Structures & Invoices | RW | - | RW | - | - | Self (R) | Child (R) |
| Payment Recording | RW | - | RW | - | - | - | - |
| Study Room Inventory & Alloc | RW | - | - | - | RW | Self (R) | Child (R) |
| Hostel Inventory & Alloc | RW | - | - | RW | - | Self (R) | Child (R) |
| Batch Attendance Marking | RW | RW (Assigned) | - | - | - | Self (R) | Child (R) |
| Hostel Attendance Marking | RW | - | - | RW | - | Self (R) | Child (R) |
| Study Room Attendance Marking| RW | - | - | - | RW | Self (R) | Child (R) |
| Exam Marks Entry | RW | RW (Assigned) | - | - | - | - | - |
| Result Publication | RW | - | - | - | - | Self (R) | Child (R) |
| System Settings & Users | RW | - | - | - | - | - | - |
