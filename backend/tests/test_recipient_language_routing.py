import pytest
from app.models.student import Student, Guardian, StudentGuardian
from app.modules.notifications.service import notification_dispatcher

def test_resolve_whatsapp_recipients_distinct_numbers():
    # Setup student and distinct guardian
    stu = Student(
        first_name="Harshvardhan",
        last_name="Patil",
        mobile="+919420010019"
    )
    g = Guardian(
        first_name="Ramesh",
        last_name="Patil",
        mobile="+917083738373"
    )
    sg = StudentGuardian(
        student=stu,
        guardian=g,
        is_primary=True,
        receives_notifications=True
    )
    stu.guardians = [sg]

    recipients = notification_dispatcher._resolve_whatsapp_recipients(stu)
    assert len(recipients) == 2

    # Parent recipient must be Marathi ('mr')
    parent_rc = next(r for r in recipients if r["role"] == "PARENT")
    assert parent_rc["phone"] == "+917083738373"
    assert parent_rc["language"] == "mr"
    assert "Ramesh Patil" in parent_rc["name"]

    # Student recipient must be English ('en_US')
    student_rc = next(r for r in recipients if r["role"] == "STUDENT")
    assert student_rc["phone"] == "+919420010019"
    assert student_rc["language"] == "en_US"
    assert "Harshvardhan Patil" in student_rc["name"]


def test_resolve_whatsapp_recipients_shared_number():
    # Shared number scenario (only 1 parent phone)
    shared_phone = "+919420010019"
    stu = Student(
        first_name="Harshvardhan",
        last_name="Patil",
        mobile=shared_phone
    )
    g = Guardian(
        first_name="Vaishnavi",
        last_name="Patil",
        mobile=shared_phone
    )
    sg = StudentGuardian(
        student=stu,
        guardian=g,
        is_primary=True,
        receives_notifications=True
    )
    stu.guardians = [sg]

    recipients = notification_dispatcher._resolve_whatsapp_recipients(stu)
    # Must de-duplicate so parent doesn't receive double messages
    assert len(recipients) == 1
    assert recipients[0]["phone"] == shared_phone
    assert recipients[0]["language"] == "mr"
    assert recipients[0]["role"] == "PARENT"
