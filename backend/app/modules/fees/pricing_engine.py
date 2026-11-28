from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from pydantic import BaseModel
from app.core.exceptions import BadRequestException


class FeeItemCalculation(BaseModel):
    description: str
    service_type: str  # TUITION, HOSTEL, STUDY_ROOM, MISC
    subject_id: Optional[str] = None
    service_id: Optional[str] = None
    unit_price: Decimal
    quantity: int = 1
    discount_amount: Decimal = Decimal("0.00")
    total_amount: Decimal


class InstallmentBreakdown(BaseModel):
    installment_number: int
    due_date: date
    amount: Decimal


class FeePreviewResult(BaseModel):
    items: List[FeeItemCalculation]
    subtotal: Decimal
    total_discount: Decimal
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal
    deposit_amount: Decimal
    installments: List[InstallmentBreakdown]


class PricingEngine:
    """
    Dedicated financial calculation engine.
    Ensures zero floating-point arithmetic and prevents double-charging
    when package pricing and individual subject selections overlap.
    """

    @staticmethod
    def round_currency(val: Decimal) -> Decimal:
        return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @classmethod
    def calculate_fees(
        cls,
        base_course_fee: Decimal = Decimal("0.00"),
        one_time_course_fee: Optional[Decimal] = None,
        installment_course_fee: Optional[Decimal] = None,
        package_group_fee: Optional[Decimal] = None,
        one_time_package_fee: Optional[Decimal] = None,
        installment_package_fee: Optional[Decimal] = None,
        package_subject_ids: Optional[List[str]] = None,
        selected_subjects: Optional[List[Dict[str, Any]]] = None,  # list of {id, name, fee}
        hostel_plan: Optional[Dict[str, Any]] = None,  # {name, base_amount, deposit_amount, months}
        study_room_plan: Optional[Dict[str, Any]] = None,  # {name, base_amount, deposit_amount, months}
        admission_fee: Decimal = Decimal("0.00"),
        discount_amount: Decimal = Decimal("0.00"),
        number_of_installments: int = 1,
        start_date: Optional[date] = None,
        custom_installments: Optional[List[Any]] = None
    ) -> FeePreviewResult:
        if start_date is None:
            start_date = date.today()

        items: List[FeeItemCalculation] = []
        covered_subject_ids = set(package_subject_ids or [])
        total_deposit = Decimal("0.00")

        # Determine effective package fee and course fee based on installment count
        is_installment_plan = number_of_installments > 1

        effective_pkg_fee = None
        if package_group_fee is not None:
            if is_installment_plan and installment_package_fee is not None and installment_package_fee > Decimal("0.00"):
                effective_pkg_fee = installment_package_fee
            elif not is_installment_plan and one_time_package_fee is not None and one_time_package_fee > Decimal("0.00"):
                effective_pkg_fee = one_time_package_fee
            else:
                effective_pkg_fee = package_group_fee

        effective_crs_fee = base_course_fee
        if is_installment_plan and installment_course_fee is not None and installment_course_fee > Decimal("0.00"):
            effective_crs_fee = installment_course_fee
        elif not is_installment_plan and one_time_course_fee is not None and one_time_course_fee > Decimal("0.00"):
            effective_crs_fee = one_time_course_fee

        # 1. Course Base Fee or Package Group Fee
        if effective_pkg_fee is not None and effective_pkg_fee > Decimal("0.00"):
            desc = "Curriculum Subject Package"
            if is_installment_plan and installment_package_fee and installment_package_fee > Decimal("0.00"):
                desc = "Curriculum Subject Package (Installment Rate)"
            elif not is_installment_plan and one_time_package_fee and one_time_package_fee > Decimal("0.00"):
                desc = "Curriculum Subject Package (One-Time Rate)"

            items.append(
                FeeItemCalculation(
                    description=desc,
                    service_type="TUITION",
                    unit_price=cls.round_currency(effective_pkg_fee),
                    quantity=1,
                    discount_amount=Decimal("0.00"),
                    total_amount=cls.round_currency(effective_pkg_fee)
                )
            )
        elif effective_crs_fee > Decimal("0.00"):
            desc = "Course Tuition Fee"
            if is_installment_plan and installment_course_fee and installment_course_fee > Decimal("0.00"):
                desc = "Course Tuition Fee (Installment Rate)"
            elif not is_installment_plan and one_time_course_fee and one_time_course_fee > Decimal("0.00"):
                desc = "Course Tuition Fee (One-Time Rate)"

            items.append(
                FeeItemCalculation(
                    description=desc,
                    service_type="TUITION",
                    unit_price=cls.round_currency(effective_crs_fee),
                    quantity=1,
                    discount_amount=Decimal("0.00"),
                    total_amount=cls.round_currency(effective_crs_fee)
                )
            )

        # 2. Standalone Subject Pricing (Deduplicate if already in package)
        if selected_subjects:
            for subj in selected_subjects:
                s_id = str(subj.get("id"))
                s_name = subj.get("name", "Subject")
                s_fee = Decimal(str(subj.get("fee", 0.00)))

                if s_id in covered_subject_ids:
                    # Subject is already covered by the package: DO NOT DOUBLE CHARGE!
                    continue

                if s_fee > Decimal("0.00"):
                    items.append(
                        FeeItemCalculation(
                            description=f"Individual Subject: {s_name}",
                            service_type="TUITION",
                            subject_id=s_id,
                            unit_price=cls.round_currency(s_fee),
                            quantity=1,
                            discount_amount=Decimal("0.00"),
                            total_amount=cls.round_currency(s_fee)
                        )
                    )

        # 3. Admission Fee
        if admission_fee > Decimal("0.00"):
            items.append(
                FeeItemCalculation(
                    description="One-time Admission & Registration Fee",
                    service_type="MISC",
                    unit_price=cls.round_currency(admission_fee),
                    quantity=1,
                    discount_amount=Decimal("0.00"),
                    total_amount=cls.round_currency(admission_fee)
                )
            )

        # 4. Hostel Service Charges
        if hostel_plan:
            h_base = Decimal(str(hostel_plan.get("base_amount", 0.00)))
            h_dep = Decimal(str(hostel_plan.get("deposit_amount", 0.00)))
            h_name = hostel_plan.get("name", "Hostel Boarding Plan")
            h_months = hostel_plan.get("months")
            h_monthly = hostel_plan.get("monthly_charge")

            h_desc = f"Hostel Facility: {h_name}"
            if h_months and h_monthly:
                h_desc = f"Hostel Facility: {h_name} ({h_months} Month{'s' if h_months > 1 else ''} @ ₹{Decimal(str(h_monthly)):,.2f}/mo)"

            if h_base > Decimal("0.00"):
                items.append(
                    FeeItemCalculation(
                        description=h_desc,
                        service_type="HOSTEL",
                        unit_price=cls.round_currency(h_base),
                        quantity=1,
                        discount_amount=Decimal("0.00"),
                        total_amount=cls.round_currency(h_base)
                    )
                )
            if h_dep > Decimal("0.00"):
                total_deposit += cls.round_currency(h_dep)
                items.append(
                    FeeItemCalculation(
                        description="Hostel Security Deposit (Refundable)",
                        service_type="HOSTEL",
                        unit_price=cls.round_currency(h_dep),
                        quantity=1,
                        discount_amount=Decimal("0.00"),
                        total_amount=cls.round_currency(h_dep)
                    )
                )

        # 5. Study Room Facility Charges
        if study_room_plan:
            sr_base = Decimal(str(study_room_plan.get("base_amount", 0.00)))
            sr_dep = Decimal(str(study_room_plan.get("deposit_amount", 0.00)))
            sr_name = study_room_plan.get("name", "Study Room Facility")
            sr_months = study_room_plan.get("months")
            sr_monthly = study_room_plan.get("monthly_charge")

            sr_desc = f"Study Room Seat: {sr_name}"
            if sr_months and sr_monthly:
                sr_desc = f"Study Room Seat: {sr_name} ({sr_months} Month{'s' if sr_months > 1 else ''} @ ₹{Decimal(str(sr_monthly)):,.2f}/mo)"

            if sr_base > Decimal("0.00"):
                items.append(
                    FeeItemCalculation(
                        description=sr_desc,
                        service_type="STUDY_ROOM",
                        unit_price=cls.round_currency(sr_base),
                        quantity=1,
                        discount_amount=Decimal("0.00"),
                        total_amount=cls.round_currency(sr_base)
                    )
                )
            if sr_dep > Decimal("0.00"):
                total_deposit += cls.round_currency(sr_dep)
                items.append(
                    FeeItemCalculation(
                        description="Study Room Key/Locker Deposit (Refundable)",
                        service_type="STUDY_ROOM",
                        unit_price=cls.round_currency(sr_dep),
                        quantity=1,
                        discount_amount=Decimal("0.00"),
                        total_amount=cls.round_currency(sr_dep)
                    )
                )

        # Totals computation
        subtotal = sum((item.total_amount for item in items), Decimal("0.00"))
        discount = min(discount_amount, subtotal)
        total_amount = max(Decimal("0.00"), subtotal - discount)

        # Installments Generation
        installments: List[InstallmentBreakdown] = []
        if total_amount > Decimal("0.00"):
            def get_item(obj, key):
                if isinstance(obj, dict):
                    return obj.get(key)
                return getattr(obj, key, None)

            if number_of_installments <= 1:
                inst_due = start_date
                if custom_installments and len(custom_installments) >= 1:
                    c_due = get_item(custom_installments[0], "due_date")
                    if c_due:
                        inst_due = c_due
                installments.append(
                    InstallmentBreakdown(
                        installment_number=1,
                        due_date=inst_due,
                        amount=cls.round_currency(total_amount)
                    )
                )
            elif custom_installments and len(custom_installments) == number_of_installments:
                sorted_custom = sorted(custom_installments, key=lambda x: get_item(x, "installment_number") or 0)

                # Validate chronological order
                for idx in range(len(sorted_custom)):
                    c_due = get_item(sorted_custom[idx], "due_date")
                    if not c_due:
                        raise BadRequestException(f"Due date missing for installment #{idx + 1}")
                    if idx > 0:
                        prev_due = get_item(sorted_custom[idx - 1], "due_date")
                        if c_due < prev_due:
                            raise BadRequestException(
                                f"Installment #{idx + 1} due date ({c_due}) cannot be earlier than installment #{idx} ({prev_due})"
                            )

                # Check if custom amounts were provided
                has_custom_amounts = any(get_item(c, "amount") is not None for c in sorted_custom)
                if has_custom_amounts:
                    custom_sum = sum(Decimal(str(get_item(c, "amount") or 0)) for c in sorted_custom)
                    if custom_sum != total_amount:
                        raise BadRequestException(
                            f"Sum of custom installment amounts (₹{custom_sum}) must exactly equal total payable fee (₹{total_amount})"
                        )
                    for c in sorted_custom:
                        installments.append(
                            InstallmentBreakdown(
                                installment_number=get_item(c, "installment_number"),
                                due_date=get_item(c, "due_date"),
                                amount=cls.round_currency(Decimal(str(get_item(c, "amount"))))
                            )
                        )
                else:
                    # Equal split with custom due dates
                    base_part = (total_amount / Decimal(number_of_installments)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    remainder = total_amount - (base_part * Decimal(number_of_installments))
                    for i, c in enumerate(sorted_custom, start=1):
                        inst_amount = base_part + (remainder if i == 1 else Decimal("0.00"))
                        installments.append(
                            InstallmentBreakdown(
                                installment_number=i,
                                due_date=get_item(c, "due_date"),
                                amount=cls.round_currency(inst_amount)
                            )
                        )
            else:
                base_part = (total_amount / Decimal(number_of_installments)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                remainder = total_amount - (base_part * Decimal(number_of_installments))

                for i in range(1, number_of_installments + 1):
                    # Distribute remainder in the first installment
                    inst_amount = base_part + (remainder if i == 1 else Decimal("0.00"))
                    # 30-day spacing per installment
                    inst_due = start_date + timedelta(days=30 * (i - 1))
                    installments.append(
                        InstallmentBreakdown(
                            installment_number=i,
                            due_date=inst_due,
                            amount=cls.round_currency(inst_amount)
                        )
                    )

        return FeePreviewResult(
            items=items,
            subtotal=cls.round_currency(subtotal),
            total_discount=cls.round_currency(discount),
            tax_amount=Decimal("0.00"),
            total_amount=cls.round_currency(total_amount),
            deposit_amount=cls.round_currency(total_deposit),
            installments=installments
        )
