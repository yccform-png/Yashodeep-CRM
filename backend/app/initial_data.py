import sys
import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SyncSessionLocal
from app.core.config import settings
from app.core.security import get_password_hash
from app.core.permissions import SystemRole, DEFAULT_ROLE_PERMISSIONS
from app.models import (
    Institute, InstituteSetting, User, Role, Permission, UserRole, RolePermission,
    AcademicYear, AcademicLevel, Class, Stream, Subject, ClassSubject,
    CourseType, Course, CourseVersion, CourseVersionSubject, SubjectGroup, SubjectGroupItem,
    ServiceType, ServicePlan, StudyRoom, StudyRoomCategory, StudySeat,
    Hostel, HostelBuilding, HostelFloor, HostelRoom, HostelBed,
    ExamType, GradingScale, Classroom, Teacher, Batch, BatchSubject
)


def seed_data():
    db = SyncSessionLocal()
    try:
        print("🌱 Starting Institute ERP database seed...")

        # 1. Institute
        institute = db.query(Institute).filter_by(code=settings.INSTITUTE_CODE).first()
        if not institute:
            institute = Institute(
                name=settings.INSTITUTE_NAME,
                code=settings.INSTITUTE_CODE,
                contact_email=settings.INSTITUTE_EMAIL,
                contact_phone=settings.INSTITUTE_PHONE,
                address="Yashodeep Campus, Kuditre, Karveer, Kolhapur, Maharashtra",
                is_active=True
            )
            db.add(institute)
            db.flush()
            print(f"✅ Created Institute: {institute.name} ({institute.code})")

        # 2. Roles & Permissions
        created_permissions = {}
        for role_enum, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
            for code in perm_codes:
                if code not in created_permissions:
                    perm = db.query(Permission).filter_by(code=code).first()
                    if not perm:
                        parts = code.split(":")
                        module = parts[0]
                        action = parts[1] if len(parts) > 1 else "*"
                        perm = Permission(
                            module=module,
                            action=action,
                            code=code,
                            description=f"Allows {action} on {module}"
                        )
                        db.add(perm)
                        db.flush()
                    created_permissions[code] = perm

        roles_map = {}
        for role_enum, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
            role = db.query(Role).filter_by(code=role_enum.value).first()
            if not role:
                role = Role(
                    institute_id=institute.id,
                    name=role_enum.value.replace("_", " ").title(),
                    code=role_enum.value,
                    description=f"System role for {role_enum.value}",
                    is_system=True
                )
                db.add(role)
                db.flush()
                # Attach permissions
                for pcode in perm_codes:
                    if pcode in created_permissions:
                        rp = RolePermission(role_id=role.id, permission_id=created_permissions[pcode].id)
                        db.add(rp)
            roles_map[role_enum.value] = role
        db.flush()
        print("✅ Seeded system roles and granular permissions")

        # 3. Super Admin User
        admin_user = db.query(User).filter_by(email=settings.FIRST_SUPERUSER_EMAIL).first()
        if not admin_user:
            old_admin = db.query(User).filter(User.email.in_(["admin@institute.edu", settings.FIRST_SUPERUSER_EMAIL])).first()
            if old_admin:
                old_admin.email = settings.FIRST_SUPERUSER_EMAIL
                old_admin.hashed_password = get_password_hash(settings.FIRST_SUPERUSER_PASSWORD)
                old_admin.first_name = settings.FIRST_SUPERUSER_FIRSTNAME
                old_admin.last_name = settings.FIRST_SUPERUSER_LASTNAME
                old_admin.is_active = True
                old_admin.is_verified = True
                db.flush()
                admin_user = old_admin
                print(f"✅ Updated Super Admin: {admin_user.email}")
            else:
                admin_user = User(
                    institute_id=institute.id,
                    email=settings.FIRST_SUPERUSER_EMAIL,
                    mobile="+919999900001",
                    hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
                    first_name=settings.FIRST_SUPERUSER_FIRSTNAME,
                    last_name=settings.FIRST_SUPERUSER_LASTNAME,
                    user_type=SystemRole.SUPER_ADMIN.value,
                    is_active=True,
                    is_verified=True
                )
                db.add(admin_user)
                db.flush()

                # Assign Super Admin Role
                super_role = roles_map[SystemRole.SUPER_ADMIN.value]
                ur = UserRole(user_id=admin_user.id, role_id=super_role.id)
                db.add(ur)
                db.flush()
                print(f"✅ Created Super Admin: {admin_user.email}")

        # 4. Academic Master Configuration
        # Academic Year
        ay = db.query(AcademicYear).filter_by(code="AY-2026-27").first()
        if not ay:
            ay = AcademicYear(
                institute_id=institute.id,
                name="2026-2027",
                code="AY-2026-27",
                start_date=date(2026, 6, 1),
                end_date=date(2027, 5, 31),
                is_current=True,
                is_active=True
            )
            db.add(ay)
            db.flush()
            print(f"✅ Created Academic Year: {ay.name}")

        # Academic Levels
        levels_data = [
            ("Middle School", "MIDDLE", 1),
            ("Secondary", "SECONDARY", 2),
            ("Higher Secondary", "HIGHER_SECONDARY", 3)
        ]
        levels = {}
        for name, code, order in levels_data:
            lvl = db.query(AcademicLevel).filter_by(code=code).first()
            if not lvl:
                lvl = AcademicLevel(name=name, code=code, order_index=order)
                db.add(lvl)
                db.flush()
            levels[code] = lvl

        # Classes: 5th through 12th
        classes_data = [
            ("5th Standard", "STD-05", levels["MIDDLE"].id, 1),
            ("6th Standard", "STD-06", levels["MIDDLE"].id, 2),
            ("7th Standard", "STD-07", levels["MIDDLE"].id, 3),
            ("8th Standard", "STD-08", levels["MIDDLE"].id, 4),
            ("9th Standard", "STD-09", levels["SECONDARY"].id, 5),
            ("10th Standard", "STD-10", levels["SECONDARY"].id, 6),
            ("11th Standard", "STD-11", levels["HIGHER_SECONDARY"].id, 7),
            ("12th Standard", "STD-12", levels["HIGHER_SECONDARY"].id, 8),
        ]
        classes = {}
        for name, code, lvl_id, order in classes_data:
            c = db.query(Class).filter_by(code=code).first()
            if not c:
                c = Class(institute_id=institute.id, level_id=lvl_id, name=name, code=code, order_index=order, is_active=True)
                db.add(c)
                db.flush()
            classes[code] = c
        print("✅ Seeded Classes 5th through 12th Standard")

        # Streams
        streams_data = [
            ("Science", "SCI", "Higher secondary science stream covering Physics, Chemistry, Mathematics, Biology and Competitive Exams"),
            ("Commerce", "COMM", "Higher secondary commerce stream covering Accountancy, Economics, Business Studies, and Mathematics"),
            ("General", "GEN", "General curriculum for foundational grades 5th to 10th")
        ]
        streams = {}
        for name, code, desc in streams_data:
            s = db.query(Stream).filter_by(code=code).first()
            if not s:
                s = Stream(institute_id=institute.id, name=name, code=code, description=desc, is_active=True)
                db.add(s)
                db.flush()
            streams[code] = s

        # Subjects
        subjects_data = [
            ("Science", "SCI", 80, 20, Decimal("4000.00")),
            ("Science A", "SCI-A", 80, 20, Decimal("4500.00")),
            ("Science B", "SCI-B", 80, 20, Decimal("4500.00")),
            ("Algebra", "ALG", 80, 20, Decimal("4500.00")),
            ("Geometry", "GEOM", 80, 20, Decimal("4500.00")),
            ("Physics", "PHY", 70, 30, Decimal("10000.00")),
            ("Chemistry", "CHEM", 70, 30, Decimal("10000.00")),
            ("Mathematics", "MATH", 80, 20, Decimal("11000.00")),
            ("Biology", "BIO", 70, 30, Decimal("10000.00")),
            ("English", "ENG", 80, 20, Decimal("6000.00")),
            ("CET Mock & Practice", "CET-PRAC", 100, 0, Decimal("12000.00")),
        ]
        subjects = {}
        for name, code, th, pr, fee in subjects_data:
            subj = db.query(Subject).filter_by(code=code).first()
            if not subj:
                subj = Subject(
                    institute_id=institute.id,
                    name=name,
                    code=code,
                    default_theory_marks=th,
                    default_practical_marks=pr,
                    default_individual_fee=fee,
                    is_active=True
                )
                db.add(subj)
                db.flush()
            subjects[code] = subj
        print("✅ Seeded Academic Subjects")

        # Pre-configured Subject Groups (e.g. PCM, PCB, PCMB)
        groups_data = [
            ("PCM Package", "PCM", classes["STD-11"].id, streams["SCI"].id, Decimal("28000.00"), ["PHY", "CHEM", "MATH"]),
            ("PCB Package", "PCB", classes["STD-11"].id, streams["SCI"].id, Decimal("27000.00"), ["PHY", "CHEM", "BIO"]),
            ("PCMB Comprehensive Package", "PCMB", classes["STD-11"].id, streams["SCI"].id, Decimal("35000.00"), ["PHY", "CHEM", "MATH", "BIO"]),
            ("12th PCMB Package", "PCMB-12", classes["STD-12"].id, streams["SCI"].id, Decimal("38000.00"), ["PHY", "CHEM", "MATH", "BIO"]),
        ]
        for name, code, cls_id, strm_id, fee, sub_codes in groups_data:
            grp = db.query(SubjectGroup).filter_by(code=code).first()
            if not grp:
                grp = SubjectGroup(
                    institute_id=institute.id,
                    class_id=cls_id,
                    stream_id=strm_id,
                    name=name,
                    code=code,
                    package_fee=fee,
                    is_active=True
                )
                db.add(grp)
                db.flush()
                for scode in sub_codes:
                    if scode in subjects:
                        item = SubjectGroupItem(subject_group_id=grp.id, subject_id=subjects[scode].id)
                        db.add(item)
                db.flush()
        print("✅ Seeded Subject Groups (PCM, PCB, PCMB)")

        # Course Types
        ctypes_data = [
            ("Regular Board Preparation", "REGULAR"),
            ("Competitive Examination (CET)", "COMPETITIVE_CET"),
            ("Integrated (Board + CET)", "INTEGRATED_CET"),
            ("Individual Subject Coaching", "SUBJECT_COACHING")
        ]
        ctypes = {}
        for name, code in ctypes_data:
            ct = db.query(CourseType).filter_by(code=code).first()
            if not ct:
                ct = CourseType(name=name, code=code)
                db.add(ct)
                db.flush()
            ctypes[code] = ct

        # Seed initial Courses & Course Versions
        courses_data = [
            ("5th Standard - Foundation Curriculum", "CRS-05-REG", ctypes["REGULAR"].id, classes["STD-05"].id, None, Decimal("18000.00"), ["SCI", "MATH", "ENG"]),
            ("6th Standard - Foundation Curriculum", "CRS-06-REG", ctypes["REGULAR"].id, classes["STD-06"].id, None, Decimal("20000.00"), ["SCI", "MATH", "ENG"]),
            ("7th Standard - Foundation Curriculum", "CRS-07-REG", ctypes["REGULAR"].id, classes["STD-07"].id, None, Decimal("22000.00"), ["SCI", "MATH", "ENG"]),
            ("8th Standard - Foundation Curriculum", "CRS-08-REG", ctypes["REGULAR"].id, classes["STD-08"].id, None, Decimal("24000.00"), ["SCI", "MATH", "ENG"]),
            ("9th Standard - Board Curriculum", "CRS-09-BOARD", ctypes["REGULAR"].id, classes["STD-09"].id, None, Decimal("28000.00"), ["SCI-A", "SCI-B", "ALG", "GEOM", "ENG"]),
            ("10th Standard - Board Curriculum", "CRS-10-BOARD", ctypes["REGULAR"].id, classes["STD-10"].id, None, Decimal("32000.00"), ["SCI-A", "SCI-B", "ALG", "GEOM", "ENG"]),
            ("11th Science - Integrated Regular + CET", "CRS-11-SCI-INT", ctypes["INTEGRATED_CET"].id, classes["STD-11"].id, streams["SCI"].id, Decimal("45000.00"), ["PHY", "CHEM", "MATH", "BIO", "CET-PRAC"]),
            ("12th Science - Regular + CET", "CRS-12-SCI-INT", ctypes["INTEGRATED_CET"].id, classes["STD-12"].id, streams["SCI"].id, Decimal("48000.00"), ["PHY", "CHEM", "MATH", "BIO", "CET-PRAC"]),
            ("11th Commerce - Full Stream", "CRS-11-COMM-REG", ctypes["REGULAR"].id, classes["STD-11"].id, streams["COMM"].id, Decimal("32000.00"), ["MATH", "ENG"]),
            ("12th Commerce - Full Stream", "CRS-12-COMM-REG", ctypes["REGULAR"].id, classes["STD-12"].id, streams["COMM"].id, Decimal("34000.00"), ["MATH", "ENG"]),
        ]
        courses = {}
        for name, code, ctype_id, cls_id, strm_id, base_fee, sub_codes in courses_data:
            crs = db.query(Course).filter_by(code=code).first()
            if not crs:
                crs = Course(
                    institute_id=institute.id,
                    course_type_id=ctype_id,
                    class_id=cls_id,
                    stream_id=strm_id,
                    name=name,
                    code=code,
                    duration_months=12,
                    is_active=True
                )
                db.add(crs)
                db.flush()

                # Add version 1
                cver = CourseVersion(
                    course_id=crs.id,
                    version_number=1,
                    effective_from=date(2026, 6, 1),
                    base_fee=base_fee,
                    is_active=True
                )
                db.add(cver)
                db.flush()

                for scode in sub_codes:
                    if scode in subjects:
                        cvs = CourseVersionSubject(course_version_id=cver.id, subject_id=subjects[scode].id, is_optional=False)
                        db.add(cvs)
                db.flush()
            courses[code] = crs
        print("✅ Seeded Master Courses and Course Versions")

        # Classrooms
        halls = [
            ("Lecture Hall 101", "LH-101", 60),
            ("Lecture Hall 102", "LH-102", 60),
            ("Seminar Hall A", "SH-A", 120),
        ]
        for name, code, cap in halls:
            cr = db.query(Classroom).filter_by(code=code).first()
            if not cr:
                cr = Classroom(institute_id=institute.id, name=name, code=code, capacity=cap, is_active=True)
                db.add(cr)
        db.flush()

        # 5. Service Types & Service Plans
        services_data = [
            ("TUITION", "Tuition Coaching", "Classroom and competitive coaching services"),
            ("HOSTEL", "Hostel Boarding", "Hostel accommodation, food and amenities"),
            ("STUDY_ROOM", "Study Room Facility", "Dedicated quiet 24x7 study desks and lockers")
        ]
        stypes = {}
        for code, name, desc in services_data:
            st = db.query(ServiceType).filter_by(code=code).first()
            if not st:
                st = ServiceType(code=code, name=name, description=desc, is_active=True)
                db.add(st)
                db.flush()
            stypes[code] = st

        # Plans
        plans_data = [
            (stypes["TUITION"].id, "Annual Academic Tuition", "PLN-TUIT-ANNUAL", "YEARLY", Decimal("35000.00"), Decimal("0.00")),
            (stypes["HOSTEL"].id, "Standard Hostel Room (Monthly)", "PLN-HOST-MONTHLY", "MONTHLY", Decimal("6500.00"), Decimal("5000.00")),
            (stypes["HOSTEL"].id, "Annual Hostel Package", "PLN-HOST-ANNUAL", "YEARLY", Decimal("72000.00"), Decimal("5000.00")),
            (stypes["STUDY_ROOM"].id, "Study Room - Full Year AC", "PLN-SR-ANNUAL-AC", "YEARLY", Decimal("15000.00"), Decimal("2000.00")),
            (stypes["STUDY_ROOM"].id, "Study Room - Quarterly", "PLN-SR-QUARTERLY", "QUARTERLY", Decimal("4500.00"), Decimal("1500.00")),
            (stypes["STUDY_ROOM"].id, "Study Room - Monthly", "PLN-SR-MONTHLY", "MONTHLY", Decimal("1600.00"), Decimal("1000.00")),
        ]
        for st_id, name, code, freq, amount, dep in plans_data:
            p = db.query(ServicePlan).filter_by(code=code).first()
            if not p:
                p = ServicePlan(
                    service_type_id=st_id,
                    name=name,
                    code=code,
                    billing_frequency=freq,
                    base_amount=amount,
                    deposit_amount=dep,
                    features={"wifi": True, "power_backup": True},
                    is_active=True
                )
                db.add(p)
        db.flush()
        print("✅ Seeded Service Types and Configurable Service Plans")

        # 6. Study Room Management: 150 Initial Seats (105 Boys, 45 Girls)
        study_room = db.query(StudyRoom).filter_by(code="SR-MAIN").first()
        if not study_room:
            study_room = StudyRoom(
                institute_id=institute.id,
                name="Yashodeep Central Campus Study Library",
                code="SR-MAIN",
                floor_number=2,
                gender_restriction="ANY",
                total_capacity=150,
                is_active=True
            )
            db.add(study_room)
            db.flush()

        cat_std = db.query(StudyRoomCategory).filter_by(code="STD").first()
        if not cat_std:
            cat_std = StudyRoomCategory(name="Standard Quiet Desk", code="STD", price_multiplier=Decimal("1.00"), description="Quiet desk with charging point")
            db.add(cat_std)
            db.flush()

        # Seed 105 Boys Seats (B001 to B105)
        existing_seats = db.query(StudySeat).filter_by(study_room_id=study_room.id).count()
        if existing_seats < 150:
            print("🪑 Seeding 150 study seats (105 Boys: B001-B105, 45 Girls: G001-G045)...")
            # 105 Boys Seats
            for i in range(1, 106):
                seat_num = f"B{i:03d}"
                existing = db.query(StudySeat).filter_by(study_room_id=study_room.id, seat_number=seat_num).first()
                if not existing:
                    if 1 <= i <= 16:
                        row_id, col_id = "R1", str(i)
                    elif 17 <= i <= 32:
                        row_id, col_id = "R2", str(33 - i)
                    elif 33 <= i <= 49:
                        row_id, col_id = "R3", str(i - 32)
                    elif 50 <= i <= 66:
                        row_id, col_id = "R4", str(67 - i)
                    elif 67 <= i <= 83:
                        row_id, col_id = "R5", str(i - 66)
                    elif 84 <= i <= 100:
                        row_id, col_id = "R6", str(101 - i)
                    else:
                        row_id, col_id = "R7", str(i - 100)
                    seat = StudySeat(
                        study_room_id=study_room.id,
                        category_id=cat_std.id,
                        seat_number=seat_num,
                        row_identifier=row_id,
                        column_identifier=col_id,
                        gender_allowed="BOYS",
                        has_power_outlet=True,
                        has_locker=True,
                        status="AVAILABLE",
                        is_active=True
                    )
                    db.add(seat)

            # 45 Girls Seats (G001 to G045)
            for i in range(1, 46):
                seat_num = f"G{i:03d}"
                existing = db.query(StudySeat).filter_by(study_room_id=study_room.id, seat_number=seat_num).first()
                if not existing:
                    if 1 <= i <= 10:
                        row_id, col_id = "R1", str(i)
                    elif 11 <= i <= 22:
                        row_id, col_id = "R2", str(23 - i)
                    elif 23 <= i <= 34:
                        row_id, col_id = "R3", str(i - 22)
                    else:
                        row_id, col_id = "R4", str(46 - i)
                    seat = StudySeat(
                        study_room_id=study_room.id,
                        category_id=cat_std.id,
                        seat_number=seat_num,
                        row_identifier=row_id,
                        column_identifier=col_id,
                        gender_allowed="GIRLS",
                        has_power_outlet=True,
                        has_locker=True,
                        status="AVAILABLE",
                        is_active=True
                    )
                    db.add(seat)
            db.flush()
            print("✅ Verified 150 Study Room Seats created (105 Boys, 45 Girls)")

        # 7. Hostel Management Property Seed
        h_boys = db.query(Hostel).filter_by(code="H-BOYS").first()
        if not h_boys:
            h_boys = Hostel(
                institute_id=institute.id,
                name="Yashodeep Boys Residential Hostel",
                code="H-BOYS",
                gender_type="BOYS",
                address="North Wing, Yashodeep Campus, Kuditre",
                is_active=True
            )
            db.add(h_boys)
            db.flush()

            bld = HostelBuilding(hostel_id=h_boys.id, name="Block A", code="BLK-A", total_floors=2)
            db.add(bld)
            db.flush()

            flr1 = HostelFloor(building_id=bld.id, floor_number=1, name="First Floor")
            db.add(flr1)
            db.flush()

            for r_num in ["101", "102", "103"]:
                room = HostelRoom(
                    floor_id=flr1.id,
                    room_number=r_num,
                    room_type="DOUBLE",
                    capacity=2,
                    has_attached_bathroom=True,
                    is_ac=False,
                    is_active=True
                )
                db.add(room)
                db.flush()
                for b_suffix in ["A", "B"]:
                    bed = HostelBed(
                        room_id=room.id,
                        bed_number=f"{r_num}-{b_suffix}",
                        bed_label=f"Bed {b_suffix}",
                        status="AVAILABLE",
                        is_active=True
                    )
                    db.add(bed)
            db.flush()
            print("✅ Seeded Boys Hostel with Rooms and Beds")

        h_girls = db.query(Hostel).filter_by(code="H-GIRLS").first()
        if not h_girls:
            h_girls = Hostel(
                institute_id=institute.id,
                name="Yashodeep Girls Residential Hostel",
                code="H-GIRLS",
                gender_type="GIRLS",
                address="South Wing, Yashodeep Campus, Kuditre",
                is_active=True
            )
            db.add(h_girls)
            db.flush()

            bld = HostelBuilding(hostel_id=h_girls.id, name="Block G", code="BLK-G", total_floors=2)
            db.add(bld)
            db.flush()

            flr1 = HostelFloor(building_id=bld.id, floor_number=1, name="First Floor")
            db.add(flr1)
            db.flush()

            for r_num in ["201", "202"]:
                room = HostelRoom(
                    floor_id=flr1.id,
                    room_number=r_num,
                    room_type="DOUBLE",
                    capacity=2,
                    has_attached_bathroom=True,
                    is_ac=True,
                    is_active=True
                )
                db.add(room)
                db.flush()
                for b_suffix in ["A", "B"]:
                    bed = HostelBed(
                        room_id=room.id,
                        bed_number=f"{r_num}-{b_suffix}",
                        bed_label=f"Bed {b_suffix}",
                        status="AVAILABLE",
                        is_active=True
                    )
                    db.add(bed)
            db.flush()
            print("✅ Seeded Girls Hostel with Rooms and Beds")

        # 8. Exam Types & Grading Scales
        etypes = [
            ("Weekly Unit Assessment", "UNIT_TEST", 100),
            ("CET Full Mock Test", "CET_MOCK", 100),
            ("Semester Term Examination", "SEMESTER", 100),
        ]
        for name, code, wt in etypes:
            et = db.query(ExamType).filter_by(code=code).first()
            if not et:
                et = ExamType(institute_id=institute.id, name=name, code=code, weightage_percent=wt)
                db.add(et)
        db.flush()

        gscale = db.query(GradingScale).filter_by(name="Standard 10-Point Scale").first()
        if not gscale:
            gscale = GradingScale(
                institute_id=institute.id,
                name="Standard 10-Point Scale",
                grades={
                    "ranges": [
                        {"min": 90, "max": 100, "grade": "A+", "points": 10},
                        {"min": 80, "max": 89.99, "grade": "A", "points": 9},
                        {"min": 70, "max": 79.99, "grade": "B+", "points": 8},
                        {"min": 60, "max": 69.99, "grade": "B", "points": 7},
                        {"min": 50, "max": 59.99, "grade": "C", "points": 6},
                        {"min": 35, "max": 49.99, "grade": "D", "points": 4},
                        {"min": 0, "max": 34.99, "grade": "F", "points": 0},
                    ]
                }
            )
            db.add(gscale)
            db.flush()

        # 9. Classrooms, Teachers, and Batches
        croom = db.query(Classroom).filter_by(code="CR-101").first()
        if not croom:
            croom = Classroom(
                institute_id=institute.id,
                name="Hall A - Smart Lecture Theater",
                code="CR-101",
                capacity=80,
                location="Main Academic Block, 1st Floor",
                has_projector=True,
                is_active=True
            )
            db.add(croom)
            db.flush()

        t_user = db.query(User).filter_by(email="teacher@institute.edu").first()
        if not t_user:
            t_user = User(
                institute_id=institute.id,
                email="teacher@institute.edu",
                mobile="+919999900002",
                hashed_password=get_password_hash("TeacherPass@2026!"),
                first_name="Rajesh",
                last_name="Sharma",
                user_type=SystemRole.TEACHER.value,
                is_active=True,
                is_verified=True
            )
            db.add(t_user)
            db.flush()

            t_role = roles_map.get(SystemRole.TEACHER.value)
            if t_role:
                db.add(UserRole(user_id=t_user.id, role_id=t_role.id))
                db.flush()

        teacher_prof = db.query(Teacher).filter_by(user_id=t_user.id).first()
        if not teacher_prof:
            teacher_prof = Teacher(
                institute_id=institute.id,
                user_id=t_user.id,
                employee_code="TCH-2026-001",
                first_name="Rajesh",
                last_name="Sharma",
                specialization="Physics & CET Specialist",
                qualification="M.Sc. Physics, Ph.D.",
                joining_date=date(2024, 6, 1),
                is_active=True
            )
            db.add(teacher_prof)
            db.flush()

        # Seed sample 12th Science batch
        course_12_sci = db.query(Course).filter_by(code="CRS-STD-12-SCI").first()
        ay_2026 = db.query(AcademicYear).filter_by(code="AY-2026-27").first()
        if course_12_sci and ay_2026:
            batch_12 = db.query(Batch).filter_by(code="BATCH-12-SCI-2026").first()
            if not batch_12:
                batch_12 = Batch(
                    course_id=course_12_sci.id,
                    academic_year_id=ay_2026.id,
                    name="12th Science Super 40 Batch",
                    code="BATCH-12-SCI-2026",
                    division="A",
                    max_capacity=40,
                    start_date=date(2026, 6, 1),
                    end_date=date(2027, 4, 30),
                    is_active=True
                )
                db.add(batch_12)
                db.flush()

                # Connect Physics subject to batch and teacher
                phy_subj = db.query(Subject).filter_by(code="PHY").first()
                if phy_subj:
                    bs = BatchSubject(
                        batch_id=batch_12.id,
                        subject_id=phy_subj.id,
                        teacher_id=teacher_prof.id,
                        classroom_id=croom.id
                    )
                    db.add(bs)
                    db.flush()

        db.commit()
        print("🎉 Database successfully seeded with all initial data!")
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
