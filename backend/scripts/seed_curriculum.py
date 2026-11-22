import asyncio
from decimal import Decimal
from datetime import date
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.models.institute import Institute
from app.models.academic import Class, Subject, CourseType, Course, CourseVersion, CourseVersionSubject, Batch, BatchSubject

async def seed_junior_and_secondary():
    async with AsyncSessionLocal() as db:
        inst = (await db.execute(select(Institute))).scalars().first()
        inst_id = inst.id

        reg_type = (await db.execute(select(CourseType).where(CourseType.code == "REGULAR"))).scalar_one()

        # 1. Subjects catalog
        new_subjects = [
            ("Science", "SCI", 80, 20, Decimal("4000.00")),
            ("Science A", "SCI-A", 80, 20, Decimal("4500.00")),
            ("Science B", "SCI-B", 80, 20, Decimal("4500.00")),
            ("Algebra", "ALG", 80, 20, Decimal("4500.00")),
            ("Geometry", "GEOM", 80, 20, Decimal("4500.00")),
        ]
        
        subj_map = {}
        all_s = (await db.execute(select(Subject))).scalars().all()
        for s in all_s:
            subj_map[s.code] = s

        for name, code, th, pr, fee in new_subjects:
            if code not in subj_map:
                s = Subject(
                    institute_id=inst_id,
                    name=name,
                    code=code,
                    default_theory_marks=th,
                    default_practical_marks=pr,
                    default_individual_fee=fee,
                    is_active=True
                )
                db.add(s)
                await db.flush()
                subj_map[code] = s
                print(f"Created Subject: {name} ({code})")

        # Classes
        classes = (await db.execute(select(Class))).scalars().all()
        class_map = {c.code: c for c in classes}

        # Courses definition: (class_code, course_name, course_code, base_fee, subject_codes)
        courses_def = [
            ("STD-05", "5th Standard - Foundation Curriculum", "CRS-05-REG", Decimal("18000.00"), ["SCI", "MATH", "ENG"]),
            ("STD-06", "6th Standard - Foundation Curriculum", "CRS-06-REG", Decimal("20000.00"), ["SCI", "MATH", "ENG"]),
            ("STD-07", "7th Standard - Foundation Curriculum", "CRS-07-REG", Decimal("22000.00"), ["SCI", "MATH", "ENG"]),
            ("STD-08", "8th Standard - Foundation Curriculum", "CRS-08-REG", Decimal("24000.00"), ["SCI", "MATH", "ENG"]),
            ("STD-09", "9th Standard - Board Curriculum", "CRS-09-BOARD", Decimal("28000.00"), ["SCI-A", "SCI-B", "ALG", "GEOM", "ENG"]),
            ("STD-10", "10th Standard - Board Curriculum", "CRS-10-BOARD", Decimal("32000.00"), ["SCI-A", "SCI-B", "ALG", "GEOM", "ENG"]),
        ]

        course_map = {}
        for c_code, c_name, crs_code, fee, s_codes in courses_def:
            cls_obj = class_map.get(c_code)
            if not cls_obj:
                continue
            
            crs = (await db.execute(select(Course).options(selectinload(Course.versions)).where(Course.code == crs_code))).scalar_one_or_none()
            if not crs and c_code == "STD-05":
                crs = (await db.execute(select(Course).options(selectinload(Course.versions)).where(Course.name == "5th Regular"))).scalar_one_or_none()
                
            if not crs:
                crs = Course(
                    institute_id=inst_id,
                    course_type_id=reg_type.id,
                    class_id=cls_obj.id,
                    stream_id=None,
                    name=c_name,
                    code=crs_code,
                    description=f"Standardized compulsory curriculum for {cls_obj.name}",
                    duration_months=12,
                    is_active=True
                )
                db.add(crs)
                await db.flush()
                print(f"Created Course: {c_name} ({crs_code})")
            else:
                crs.name = c_name
                crs.code = crs_code
                crs.description = f"Standardized compulsory curriculum for {cls_obj.name}"

            course_map[crs_code] = crs

            # Ensure CourseVersion
            ver_q = await db.execute(
                select(CourseVersion)
                .options(selectinload(CourseVersion.version_subjects))
                .where(CourseVersion.course_id == crs.id, CourseVersion.is_active == True)
            )
            ver = ver_q.scalars().first()

            if not ver:
                ver = CourseVersion(
                    course_id=crs.id,
                    version_number=1,
                    effective_from=date(2026, 4, 1),
                    base_fee=fee,
                    is_active=True
                )
                db.add(ver)
                await db.flush()
                existing_sids = set()
            else:
                ver.base_fee = fee
                existing_sids = {vs.subject_id for vs in ver.version_subjects}

            # Link subjects to course version
            for sc in s_codes:
                s_obj = subj_map[sc]
                if s_obj.id not in existing_sids:
                    cvs = CourseVersionSubject(
                        course_version_id=ver.id,
                        subject_id=s_obj.id
                    )
                    db.add(cvs)
                    print(f"  Linked {s_obj.name} to {c_name}")

        # Synchronize Batch B5 (5th Class)
        b5 = (await db.execute(select(Batch).options(selectinload(Batch.batch_subjects)).where(Batch.code == "B5"))).scalar_one_or_none()
        if b5:
            crs_05 = course_map.get("CRS-05-REG")
            if crs_05:
                b5.course_id = crs_05.id
            existing_bs_sids = {bs.subject_id for bs in b5.batch_subjects}
            for sc in ["SCI", "MATH", "ENG"]:
                s_obj = subj_map[sc]
                if s_obj.id not in existing_bs_sids:
                    bs = BatchSubject(
                        batch_id=b5.id,
                        subject_id=s_obj.id
                    )
                    db.add(bs)
                    print(f"  Provisioned BatchSubject {s_obj.name} for Batch B5")

        # Synchronize Morning Science Batch A subjects
        bat_a = (await db.execute(select(Batch).options(selectinload(Batch.batch_subjects)).where(Batch.code == "BAT-b26d9c"))).scalar_one_or_none()
        if bat_a:
            existing_bs_sids = {bs.subject_id for bs in bat_a.batch_subjects}
            for sc in ["CHEM", "MATH", "BIO"]:
                s_obj = subj_map.get(sc)
                if s_obj and s_obj.id not in existing_bs_sids:
                    bs = BatchSubject(
                        batch_id=bat_a.id,
                        subject_id=s_obj.id
                    )
                    db.add(bs)
                    print(f"  Provisioned BatchSubject {s_obj.name} for Batch A")

        await db.commit()
        print("✅ Phase 1 Database Seeding & Batch Sync completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_junior_and_secondary())
