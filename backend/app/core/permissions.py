from enum import Enum


class SystemRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
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
    SystemRole.ADMIN: [
        "ACADEMICS:*",
        "STUDENTS:*",
        "ENROLLMENTS:*",
        "ATTENDANCE:*",
        "EXAMINATIONS:*",
        "STUDY_ROOM:*",
        "HOSTEL:*",
        "REPORTS:ACADEMIC",
        "SETTINGS:READ",
        "SETTINGS:UPDATE",
        "USERS:READ",
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
