# Coaching Institute Management ERP - Database Schema Specification

## 1. Schema Design Principles
- **Primary Keys**: UUIDv4 across all operational tables for distributed uniqueness and security.
- **Financial Precision**: All monetary values (`amount`, `discount`, `balance`, `tax`) are typed as `NUMERIC(12, 2)`.
- **Temporal Integrity**: All date-times are stored in UTC (`TIMESTAMP WITH TIME ZONE`).
- **Data Integrity & Consistency**: Enforced via foreign key cascades, unique constraints, and check constraints (`CHECK (amount >= 0)`).
- **Soft Deletion & Versioning**: Master records (courses, plans) maintain versioning or active status flags to preserve historical audit integrity.

---

## 2. Table Catalog

### 2.1 Core & Multi-Tenant Support
- **institutes**: Institute master record (`id`, `name`, `code`, `logo_url`, `address`, `contact_email`, `contact_phone`, `is_active`, `created_at`, `updated_at`).
- **institute_settings**: Configurable key-value system settings (`id`, `institute_id`, `category`, `setting_key`, `setting_value_json`, `is_encrypted`).

### 2.2 Users, Roles & Permissions
- **users**: System users (`id`, `institute_id`, `email`, `mobile`, `hashed_password`, `first_name`, `last_name`, `user_type`, `is_active`, `is_verified`, `last_login_at`, `created_at`, `updated_at`).
- **roles**: System roles (`id`, `institute_id`, `name`, `code`, `description`, `is_system`, `created_at`).
- **permissions**: Granular permissions (`id`, `module`, `action`, `code`, `description`).
- **role_permissions**: Many-to-many junction (`role_id`, `permission_id`).
- **user_roles**: User role assignments (`user_id`, `role_id`).
- **audit_logs**: Immutable audit log (`id`, `institute_id`, `user_id`, `action`, `entity_name`, `entity_id`, `old_values_json`, `new_values_json`, `ip_address`, `user_agent`, `created_at`).

### 2.3 Students & Guardians
- **students**: Master student entity (`id`, `institute_id`, `user_id`, `student_code`, `first_name`, `middle_name`, `last_name`, `date_of_birth`, `gender`, `blood_group`, `mobile`, `email`, `address_line1`, `address_line2`, `city`, `state`, `pincode`, `profile_photo_url`, `admission_date`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`, `status`, `created_at`, `updated_at`).
- **guardians**: Parents & legal guardians (`id`, `institute_id`, `user_id`, `first_name`, `last_name`, `relation`, `mobile`, `email`, `occupation`, `annual_income`, `address`, `created_at`, `updated_at`).
- **student_guardians**: Student-guardian relation (`id`, `student_id`, `guardian_id`, `is_primary`, `can_pickup`, `receives_notifications`).
- **student_documents**: Uploaded document references (`id`, `student_id`, `document_type`, `file_name`, `file_url`, `file_size_bytes`, `mime_type`, `is_verified`, `verified_by_user_id`, `created_at`).

### 2.4 Academics & Courses
- **academic_years**: School/coaching years (`id`, `institute_id`, `name`, `code`, `start_date`, `end_date`, `is_current`, `is_active`).
- **academic_levels**: Level grouping e.g., Middle School, Secondary, Higher Secondary (`id`, `name`, `code`, `order_index`).
- **classes**: Standard classes 5th through 12th (`id`, `institute_id`, `level_id`, `name`, `code`, `order_index`, `is_active`).
- **streams**: Academic streams e.g., Science, Commerce, Arts, General (`id`, `institute_id`, `name`, `code`, `description`, `is_active`).
- **subjects**: Master list of subjects (`id`, `institute_id`, `name`, `code`, `default_theory_marks`, `default_practical_marks`, `is_active`).
- **class_subjects**: Available subjects per class & stream (`id`, `class_id`, `stream_id`, `subject_id`, `is_mandatory`).
- **course_types**: Course category e.g., Regular, Competitive, Integrated, Foundation (`id`, `name`, `code`).
- **courses**: Master course offerings (`id`, `institute_id`, `name`, `code`, `course_type_id`, `class_id`, `stream_id`, `description`, `duration_months`, `is_active`).
- **course_versions**: Preserves historical course structures (`id`, `course_id`, `version_number`, `effective_from`, `effective_to`, `base_fee`, `is_active`).
- **course_version_subjects**: Subjects attached to course version (`id`, `course_version_id`, `subject_id`, `is_optional`).
- **subject_groups**: Predefined subject bundles e.g., PCM, PCB, PCMB (`id`, `institute_id`, `class_id`, `stream_id`, `name`, `code`, `package_fee`, `is_active`).
- **subject_group_items**: Subjects included in a group (`id`, `subject_group_id`, `subject_id`).

### 2.5 Batches & Timetables
- **teachers**: Faculty staff profiles (`id`, `institute_id`, `user_id`, `employee_code`, `first_name`, `last_name`, `specialization`, `qualification`, `joining_date`, `is_active`).
- **classrooms**: Physical and virtual rooms (`id`, `institute_id`, `name`, `code`, `capacity`, `location`, `has_projector`, `is_active`).
- **batches**: Operational teaching groups (`id`, `course_id`, `academic_year_id`, `name`, `code`, `max_capacity`, `start_date`, `end_date`, `is_active`).
- **batch_subjects**: Faculty allocation per subject in a batch (`id`, `batch_id`, `subject_id`, `teacher_id`, `classroom_id`).
- **batch_students**: Student assignment to a batch (`id`, `batch_id`, `student_id`, `enrolled_at`, `status`).
- **timetable_entries**: Weekly lecture schedule (`id`, `batch_subject_id`, `day_of_week`, `start_time`, `end_time`, `classroom_id`).
- **timetable_exceptions**: Holiday/reschedule overrides (`id`, `batch_subject_id`, `exception_date`, `reason`, `is_cancelled`, `rescheduled_start_time`, `rescheduled_end_time`).

### 2.6 Enrollments & Admissions
- **enrollment_groups**: Connects multi-year admissions (e.g. 11th + 12th combined package) (`id`, `institute_id`, `group_code`, `enrollment_type`, `total_years`, `remarks`, `created_at`).
- **enrollments**: Individual student academic year enrollments (`id`, `enrollment_group_id`, `student_id`, `academic_year_id`, `class_id`, `stream_id`, `course_id`, `course_version_id`, `enrollment_date`, `status`, `promotion_status`, `remarks`, `created_at`, `updated_at`).
- **enrollment_subjects**: Specific subjects enrolled (`id`, `enrollment_id`, `subject_id`, `is_package_subject`, `individual_fee`, `batch_id`).

### 2.7 Service Management
- **service_types**: Service categories (`id`, `code` [TUITION, HOSTEL, STUDY_ROOM], `name`, `description`, `is_active`).
- **service_plans**: Configurable plans per service (`id`, `service_type_id`, `name`, `code`, `billing_frequency` [ONE_TIME, MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY], `base_amount`, `deposit_amount`, `features_json`, `is_active`).
- **student_services**: Student active subscriptions (`id`, `student_id`, `service_plan_id`, `academic_year_id`, `start_date`, `end_date`, `billing_frequency`, `unit_price`, `deposit_amount`, `status` [ACTIVE, EXPIRED, CANCELLED, SUSPENDED], `created_at`).

### 2.8 Fees, Invoicing & Payments
- **fee_structures**: Master fee configurations (`id`, `academic_year_id`, `class_id`, `stream_id`, `course_id`, `name`, `code`, `is_active`).
- **fee_structure_items**: Itemized components (`id`, `fee_structure_id`, `name`, `fee_type` [TUITION, EXAM, ADMISSION, MATERIAL, MISC], `amount`, `is_refundable`).
- **discount_types**: Discount and scholarship templates (`id`, `institute_id`, `name`, `code`, `discount_nature` [PERCENTAGE, FLAT], `value`, `requires_approval`, `is_active`).
- **student_discounts**: Approved discounts per student (`id`, `student_id`, `discount_type_id`, `applied_amount`, `approved_by_user_id`, `approval_notes`).
- **invoices**: Official invoice records (`id`, `institute_id`, `student_id`, `enrollment_id`, `invoice_number`, `issue_date`, `due_date`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `paid_amount`, `balance_amount`, `status` [DRAFT, ISSUED, PARTIALLY_PAID, PAID, CANCELLED, OVERDUE], `created_at`, `updated_at`).
- **invoice_items**: Line items on invoice (`id`, `invoice_id`, `description`, `service_type_code`, `service_id`, `subject_id`, `unit_price`, `quantity`, `discount_amount`, `total_amount`).
- **installment_plans**: Installment agreements (`id`, `invoice_id`, `number_of_installments`, `total_amount`, `created_at`).
- **installments**: Individual installment breakdown (`id`, `installment_plan_id`, `installment_number`, `due_date`, `amount`, `paid_amount`, `status` [PENDING, PARTIALLY_PAID, PAID, OVERDUE]).
- **payments**: Received payments (`id`, `institute_id`, `student_id`, `payment_number`, `payment_date`, `amount`, `payment_method` [CASH, UPI, CARD, NET_BANKING, CHEQUE, DEMAND_DRAFT, RAZORPAY], `transaction_reference`, `gateway_payment_id`, `gateway_order_id`, `gateway_signature`, `notes`, `status` [SUCCESS, PENDING, FAILED, REFUNDED], `collected_by_user_id`, `created_at`).
- **payment_allocations**: Allocation of payment against invoice/installments (`id`, `payment_id`, `invoice_id`, `installment_id`, `allocated_amount`, `created_at`).
- **receipts**: Official receipt document metadata (`id`, `payment_id`, `receipt_number`, `generated_at`, `pdf_url`).
- **refunds**: Processed refunds (`id`, `payment_id`, `invoice_id`, `refund_number`, `amount`, `reason`, `approved_by_user_id`, `status`, `refund_date`).

### 2.9 Study Room Management
- **study_rooms**: Physical study halls (`id`, `institute_id`, `name`, `code`, `floor_number`, `gender_restriction` [ANY, BOYS, GIRLS], `total_capacity`, `is_active`).
- **study_room_categories**: Tiered categories e.g., Standard, AC, Premium with Cubicle (`id`, `name`, `code`, `price_multiplier`, `description`).
- **study_seats**: Individual desk inventory (`id`, `study_room_id`, `category_id`, `seat_number`, `row_identifier`, `column_identifier`, `gender_allowed` [BOYS, GIRLS, ANY], `has_power_outlet`, `has_locker`, `status` [AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE], `is_active`).
- **seat_allocations**: Active and historical seat leases (`id`, `study_seat_id`, `student_id`, `student_service_id`, `start_date`, `end_date`, `status` [ACTIVE, EXPIRED, CANCELLED, TRANSFERRED], `allocated_by_user_id`, `vacated_at`, `remarks`, `created_at`).
- **seat_reservations**: Temporary reservations holding seats (`id`, `study_seat_id`, `student_id`, `reserved_until`, `reserved_by_user_id`).
- **study_room_attendance**: Check-in / check-out daily logs (`id`, `study_seat_id`, `student_id`, `check_in_time`, `check_out_time`, `date`, `recorded_by_user_id`).

### 2.10 Hostel Management
- **hostels**: Master hostel properties (`id`, `institute_id`, `name`, `code`, `gender_type` [BOYS, GIRLS], `address`, `warden_user_id`, `is_active`).
- **hostel_buildings**: Buildings within hostel premises (`id`, `hostel_id`, `name`, `code`, `total_floors`).
- **hostel_floors**: Building floors (`id`, `building_id`, `floor_number`, `name`).
- **hostel_rooms**: Physical rooms (`id`, `floor_id`, `room_number`, `room_type` [SINGLE, DOUBLE, TRIPLE, DORMITORY], `capacity`, `has_attached_bathroom`, `is_ac`, `is_active`).
- **hostel_beds**: Individual bed spaces (`id`, `room_id`, `bed_number`, `bed_label`, `status` [AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE], `is_active`).
- **bed_allocations**: Bed occupancies (`id`, `hostel_bed_id`, `student_id`, `student_service_id`, `start_date`, `end_date`, `check_in_date`, `check_out_date`, `status` [ACTIVE, VACATED, TRANSFERRED], `allocated_by_user_id`, `deposit_amount`, `created_at`).
- **hostel_attendance**: Night roll-call logs (`id`, `hostel_id`, `student_id`, `date`, `status` [PRESENT, ABSENT, ON_LEAVE, LATE], `remarks`, `marked_by_user_id`).
- **hostel_visitors**: Visitor registry (`id`, `student_id`, `visitor_name`, `visitor_phone`, `relation`, `visit_date`, `in_time`, `out_time`, `purpose`, `gate_pass_number`).
- **hostel_maintenance**: Incident and repair tickets (`id`, `hostel_room_id`, `reported_by_student_id`, `issue_type`, `description`, `priority` [LOW, MEDIUM, HIGH, URGENT], `status` [OPEN, IN_PROGRESS, RESOLVED], `resolved_at`).

### 2.11 Attendance Management
- **attendance_sessions**: Teaching attendance instances (`id`, `batch_subject_id`, `teacher_id`, `session_date`, `start_time`, `end_time`, `topic_covered`, `is_cancelled`, `created_at`).
- **attendance_records**: Individual student attendance state (`id`, `session_id`, `student_id`, `status` [PRESENT, ABSENT, LATE, EXCUSED_LEAVE], `remarks`, `marked_at`).
- **attendance_corrections**: Audit log of changed attendance marks (`id`, `attendance_record_id`, `old_status`, `new_status`, `reason`, `changed_by_user_id`, `created_at`).

### 2.12 Examinations, Marks & Grading
- **exam_types**: Categories of exams (`id`, `institute_id`, `name`, `code`, `weightage_percent`).
- **examinations**: Exam events (`id`, `institute_id`, `academic_year_id`, `exam_type_id`, `name`, `code`, `start_date`, `end_date`, `is_published`, `published_at`, `created_by_user_id`).
- **exam_subjects**: Subject evaluation criteria for exam (`id`, `examination_id`, `subject_id`, `class_id`, `stream_id`, `exam_date`, `start_time`, `duration_minutes`, `max_marks`, `passing_marks`, `has_negative_marking`, `negative_mark_weight`, `theory_max_marks`, `practical_max_marks`).
- **exam_marks**: Recorded marks per student (`id`, `exam_subject_id`, `student_id`, `theory_marks_obtained`, `practical_marks_obtained`, `total_marks_obtained`, `is_absent`, `is_withheld`, `status` [DRAFT, SUBMITTED, APPROVED], `entered_by_user_id`, `created_at`, `updated_at`).
- **grading_scales**: Configurable letter grading systems (`id`, `institute_id`, `name`, `grades_json` [min_percent, max_percent, letter_grade, grade_point]).
- **exam_results**: Calculated final report cards (`id`, `examination_id`, `student_id`, `total_obtained`, `total_possible`, `percentage`, `grade`, `rank`, `is_pass`, `generated_at`).

### 2.13 Notifications & System Outbox
- **notifications**: In-app notifications (`id`, `user_id`, `title`, `message`, `category`, `action_url`, `is_read`, `read_at`, `created_at`).
- **notification_outbox**: Reliable event queue for background SMS/Email/WhatsApp dispatcher (`id`, `event_type`, `recipient_target`, `channel` [EMAIL, SMS, WHATSAPP, IN_APP], `payload_json`, `status` [PENDING, SENT, FAILED], `retry_count`, `last_attempted_at`, `error_message`, `created_at`).
