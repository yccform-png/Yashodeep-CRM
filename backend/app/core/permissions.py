from enum import Enum


class SystemRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    ACCOUNTANT = "ACCOUNTANT"
    HOSTEL_WARDEN = "HOSTEL_WARDEN"
    STUDY_ROOM_MANAGER = "STUDY_ROOM_MANAGER"
    STUDENT = "STUDENT"
    PARENT = "PARENT"


class PermissionAction(str, Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MANAGE = "MANAGE"


class PermissionModule(str, Enum):
    ACADEMICS = "ACADEMICS"
    STUDENTS = "STUDENTS"
    ENROLLMENTS = "ENROLLMENTS"
    FEES = "FEES"
    PAYMENTS = "PAYMENTS"
    STUDY_ROOM = "STUDY_ROOM"
    HOSTEL = "HOSTEL"
    ATTENDANCE = "ATTENDANCE"
    EXAMINATIONS = "EXAMINATIONS"
    REPORTS = "REPORTS"
    SETTINGS = "SETTINGS"
    USERS = "USERS"


DEFAULT_ROLE_PERMISSIONS = {
    SystemRole.SUPER_ADMIN: ["*"],
    SystemRole.ADMIN: ["*"],
    SystemRole.TEACHER: [
        "ACADEMICS:READ",
        "STUDENTS:READ",
        "ATTENDANCE:CREATE",
        "ATTENDANCE:READ",
        "ATTENDANCE:UPDATE",
        "EXAMINATIONS:CREATE",
        "EXAMINATIONS:READ",
        "EXAMINATIONS:UPDATE",
    ],
    SystemRole.ACCOUNTANT: [
        "STUDENTS:READ",
        "ENROLLMENTS:READ",
        "FEES:MANAGE",
        "FEES:READ",
        "FEES:UPDATE",
        "PAYMENTS:CREATE",
        "PAYMENTS:READ",
        "PAYMENTS:UPDATE",
        "REPORTS:READ",
    ],
    SystemRole.HOSTEL_WARDEN: [
        "STUDENTS:READ",
        "HOSTEL:MANAGE",
        "HOSTEL:CREATE",
        "HOSTEL:READ",
        "HOSTEL:UPDATE",
        "ATTENDANCE:READ",
    ],
    SystemRole.STUDY_ROOM_MANAGER: [
        "STUDENTS:READ",
        "STUDY_ROOM:MANAGE",
        "STUDY_ROOM:CREATE",
        "STUDY_ROOM:READ",
        "STUDY_ROOM:UPDATE",
    ],
    SystemRole.STUDENT: [
        "STUDENTS:READ_SELF",
        "ACADEMICS:READ_SELF",
        "FEES:READ_SELF",
        "ATTENDANCE:READ_SELF",
        "EXAMINATIONS:READ_SELF",
        "STUDY_ROOM:READ_SELF",
        "HOSTEL:READ_SELF",
    ],
    SystemRole.PARENT: [
        "STUDENTS:READ_CHILD",
        "ACADEMICS:READ_CHILD",
        "FEES:READ_CHILD",
        "ATTENDANCE:READ_CHILD",
        "EXAMINATIONS:READ_CHILD",
    ],
}
