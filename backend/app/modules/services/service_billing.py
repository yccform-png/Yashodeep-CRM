import uuid
from typing import Optional
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.service import ServiceType, ServicePlan
from app.models.fee import Invoice, InvoiceItem, Payment, PaymentAllocation, Receipt


async def get_or_create_custom_plan(db: AsyncSession, service_type_code: str) -> ServicePlan:
    """Finds or dynamically provisions a fallback custom facility plan for ad-hoc custom billing."""
    stmt = (
        select(ServicePlan)
        .join(ServiceType)
        .where(
            ServiceType.code == service_type_code,
            ServicePlan.code == f"PLN-{service_type_code}-CUSTOM"
        )
    )
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if not plan:
        st_stmt = select(ServiceType).where(ServiceType.code == service_type_code)
        st = (await db.execute(st_stmt)).scalar_one_or_none()
        if not st:
            st = ServiceType(
                code=service_type_code,
                name=f"{service_type_code.replace('_', ' ').title()} Facility",
                description="Facility subscriptions",
                is_active=True
            )
            db.add(st)
            await db.flush()

        plan = ServicePlan(
            service_type_id=st.id,
            name=f"Custom {service_type_code.replace('_', ' ').title()} Plan",
            code=f"PLN-{service_type_code}-CUSTOM",
            billing_frequency="ONE_TIME",
            base_amount=Decimal("0.00"),
            deposit_amount=Decimal("0.00"),
            features={"custom": True},
            is_active=True
        )
        db.add(plan)
        await db.flush()

    return plan


async def create_facility_invoice_and_payment(
    db: AsyncSession,
    institute_id: Optional[uuid.UUID],
    student_id: uuid.UUID,
    service_id: uuid.UUID,
    service_type_code: str,
    item_description: str,
    rent_amount: Decimal,
    deposit_amount: Decimal,
    collect_payment: bool,
    payment_mode: str,
    collected_by_user_id: Optional[uuid.UUID]
) -> Invoice:
    """Generates official invoice for desk/bed allocation with line items for Rent and Refundable Deposit."""
    total_amount = rent_amount + deposit_amount
    inv_count = (await db.execute(select(func.count(Invoice.id)))).scalar() or 0
    invoice_number = f"INV-2026-{inv_count + 1:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count + 1:05d}"

    inv_status = "ISSUED"
    paid_amt = Decimal("0.00")
    bal_amt = total_amount
    if total_amount <= Decimal("0.00"):
        inv_status = "PAID"
        bal_amt = Decimal("0.00")
    elif collect_payment:
        inv_status = "PAID"
        paid_amt = total_amount
        bal_amt = Decimal("0.00")

    invoice = Invoice(
        institute_id=institute_id,
        student_id=student_id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=7),
        subtotal=total_amount,
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        total_amount=total_amount,
        paid_amount=paid_amt,
        balance_amount=bal_amt,
        status=inv_status
    )
    db.add(invoice)
    await db.flush()

    if rent_amount > Decimal("0.00"):
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            description=item_description,
            service_type_code=service_type_code,
            service_id=service_id,
            unit_price=rent_amount,
            quantity=1,
            discount_amount=Decimal("0.00"),
            total_amount=rent_amount
        ))

    if deposit_amount > Decimal("0.00"):
        dep_label = (
            "Study Room Key & Locker Deposit (Refundable)"
            if service_type_code == "STUDY_ROOM"
            else "Hostel Caution Deposit (Refundable)"
        )
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            description=dep_label,
            service_type_code=service_type_code,
            service_id=service_id,
            unit_price=deposit_amount,
            quantity=1,
            discount_amount=Decimal("0.00"),
            total_amount=deposit_amount
        ))

    if collect_payment and total_amount > Decimal("0.00"):
        pay_count = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
        pay_number = f"PAY-2026-{pay_count + 1:05d}"
        while (await db.execute(select(Payment.id).where(Payment.payment_number == pay_number))).scalar_one_or_none():
            pay_count += 1
            pay_number = f"PAY-2026-{pay_count + 1:05d}"
        payment = Payment(
            institute_id=institute_id,
            student_id=student_id,
            payment_number=pay_number,
            payment_date=date.today(),
            amount=total_amount,
            payment_method=payment_mode.upper(),
            notes=f"Allocation payment for {item_description}",
            status="SUCCESS",
            collected_by_user_id=collected_by_user_id
        )
        db.add(payment)
        await db.flush()

        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=invoice.id,
            allocated_amount=total_amount
        ))

        db.add(Receipt(
            payment_id=payment.id,
            receipt_number=f"RCP-2026-{pay_count + 1:05d}"
        ))

    return invoice


async def create_facility_renewal_invoice(
    db: AsyncSession,
    institute_id: Optional[uuid.UUID],
    student_id: uuid.UUID,
    service_id: uuid.UUID,
    service_type_code: str,
    item_description: str,
    renewal_rent_amount: Decimal,
    collect_payment: bool,
    payment_mode: str,
    collected_by_user_id: Optional[uuid.UUID]
) -> Invoice:
    """Generates subscription renewal invoice for next billing cycle (rent only; deposit already on file)."""
    inv_count = (await db.execute(select(func.count(Invoice.id)))).scalar() or 0
    invoice_number = f"INV-2026-{inv_count + 1:05d}"
    while (await db.execute(select(Invoice.id).where(Invoice.invoice_number == invoice_number))).scalar_one_or_none():
        inv_count += 1
        invoice_number = f"INV-2026-{inv_count + 1:05d}"

    inv_status = "ISSUED"
    paid_amt = Decimal("0.00")
    bal_amt = renewal_rent_amount
    if renewal_rent_amount <= Decimal("0.00"):
        inv_status = "PAID"
        bal_amt = Decimal("0.00")
    elif collect_payment:
        inv_status = "PAID"
        paid_amt = renewal_rent_amount
        bal_amt = Decimal("0.00")

    invoice = Invoice(
        institute_id=institute_id,
        student_id=student_id,
        invoice_number=invoice_number,
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=7),
        subtotal=renewal_rent_amount,
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        total_amount=renewal_rent_amount,
        paid_amount=paid_amt,
        balance_amount=bal_amt,
        status=inv_status
    )
    db.add(invoice)
    await db.flush()

    if renewal_rent_amount > Decimal("0.00"):
        db.add(InvoiceItem(
            invoice_id=invoice.id,
            description=f"Subscription Renewal: {item_description}",
            service_type_code=service_type_code,
            service_id=service_id,
            unit_price=renewal_rent_amount,
            quantity=1,
            discount_amount=Decimal("0.00"),
            total_amount=renewal_rent_amount
        ))

    if collect_payment and renewal_rent_amount > Decimal("0.00"):
        pay_count = (await db.execute(select(func.count(Payment.id)))).scalar() or 0
        pay_number = f"PAY-2026-{pay_count + 1:05d}"
        while (await db.execute(select(Payment.id).where(Payment.payment_number == pay_number))).scalar_one_or_none():
            pay_count += 1
            pay_number = f"PAY-2026-{pay_count + 1:05d}"
        payment = Payment(
            institute_id=institute_id,
            student_id=student_id,
            payment_number=pay_number,
            payment_date=date.today(),
            amount=renewal_rent_amount,
            payment_method=payment_mode.upper(),
            notes=f"Renewal payment for {item_description}",
            status="SUCCESS",
            collected_by_user_id=collected_by_user_id
        )
        db.add(payment)
        await db.flush()

        db.add(PaymentAllocation(
            payment_id=payment.id,
            invoice_id=invoice.id,
            allocated_amount=renewal_rent_amount
        ))

        db.add(Receipt(
            payment_id=payment.id,
            receipt_number=f"RCP-2026-{pay_count + 1:05d}"
        ))

    return invoice
