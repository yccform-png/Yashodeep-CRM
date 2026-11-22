import React, { useState } from 'react';
import {
  Layers,
  GraduationCap,
  DollarSign,
  Home,
  Armchair,
  User,
  Users,
  CheckCircle2,
  CalendarCheck,
  Award,
  Receipt,
  Wrench,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const Portals: React.FC = () => {
  const { user } = useAuth();
  const [activePortal, setActivePortal] = useState<
    'TEACHER' | 'ACCOUNTANT' | 'WARDEN' | 'STUDY_ROOM' | 'STUDENT'
  >('TEACHER');

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Role-Based Dedicated Portals</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Role-Tailored Workspaces • Strict Backend Authorization • Dedicated Dashboards for Staff, Students &amp; Parents
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 self-start md:self-auto">
          Logged in as: <span className="font-bold text-slate-900">{user?.first_name} {user?.last_name}</span> ({user?.user_type})
        </div>
      </div>

      {/* Role Navigation Pills */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { key: 'TEACHER', label: 'Faculty & Teacher Portal', icon: GraduationCap },
          { key: 'ACCOUNTANT', label: 'Accounts & Finance Portal', icon: DollarSign },
          { key: 'WARDEN', label: 'Hostel Warden Portal', icon: Home },
          { key: 'STUDY_ROOM', label: 'Study Room Desk Manager', icon: Armchair },
          { key: 'STUDENT', label: 'Student & Parent Portal', icon: User }
        ].map((p) => {
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              onClick={() => setActivePortal(p.key as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                activePortal === p.key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Portal 1: TEACHER */}
      {activePortal === 'TEACHER' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <h2 className="text-lg font-bold">Faculty Classroom & Evaluation Workspace</h2>
            <p className="text-sm text-teal-200">
              Access assigned batches, mark academic attendance, input theory/practical exam marks, and monitor syllabus coverage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Class Attendance Terminal</h3>
              <p className="text-xs text-slate-500">
                Record attendance for assigned batch subjects with 1-click status toggles and topic logs.
              </p>
              <Link
                to="/attendance"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700"
              >
                <span>Open Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Examinations & Marks Entry</h3>
              <p className="text-xs text-slate-500">
                Grade student unit tests, mock CET tests, and submit marks with negative marking support.
              </p>
              <Link
                to="/examinations"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700"
              >
                <span>Enter Marks</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Batch Student Directory</h3>
              <p className="text-xs text-slate-500">
                Inspect registered student academic profiles and historical performance trajectories.
              </p>
              <Link
                to="/students"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>View Students</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 2: ACCOUNTANT */}
      {activePortal === 'ACCOUNTANT' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <h2 className="text-lg font-bold">Institute Financial Desk & Cashier Workspace</h2>
            <p className="text-sm text-emerald-200">
              Manage student fee billing, collect installment payments, generate official receipts, and monitor outstanding dues.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Invoices & Dues Ledger</h3>
              <p className="text-xs text-slate-500">
                Inspect generated student invoices, filter overdue accounts, and execute fee payments.
              </p>
              <Link
                to="/fees"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <span>Manage Invoices</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Official Receipts & Audits</h3>
              <p className="text-xs text-slate-500">
                Issue timestamped electronic payment receipts with unique sequential receipt numbering.
              </p>
              <Link
                to="/fees"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>View Receipts</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Installment Plans</h3>
              <p className="text-xs text-slate-500">
                Track 1st, 2nd, 3rd, and 4th scheduled installments with automated status updates.
              </p>
              <Link
                to="/fees"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                <span>Review Schedule</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 3: WARDEN */}
      {activePortal === 'WARDEN' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <h2 className="text-lg font-bold">Hostel Warden & Security Administration</h2>
            <p className="text-sm text-indigo-200">
              Manage residential inventory across Boys & Girls hostels, bed allocations, security visitor logs, and repair tickets.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Hostel Bed Allocations</h3>
              <p className="text-xs text-slate-500">
                Manage room occupancy, check-in new residents, and process bed vacations.
              </p>
              <Link
                to="/hostel"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <span>Open Hostel Manager</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Security Visitor Registry</h3>
              <p className="text-xs text-slate-500">
                Log parental and guardian visits at the campus gate with phone and purpose logs.
              </p>
              <Link
                to="/hostel"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <span>Log Visitor</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Maintenance Tickets</h3>
              <p className="text-xs text-slate-500">
                Report electrical, plumbing, and AC issues with automated technician priority.
              </p>
              <Link
                to="/hostel"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700"
              >
                <span>Dispatch Work Order</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 4: STUDY ROOM */}
      {activePortal === 'STUDY_ROOM' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-950 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <h2 className="text-lg font-bold">Study Room 150-Desk Command Center</h2>
            <p className="text-sm text-emerald-300">
              Interactive visual floor grid • 105 Boys Desks (B001–B105) • 45 Girls Desks (G001–G045) • Check-In / Check-Out
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Armchair className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Visual Floor Plan & Desks</h3>
              <p className="text-xs text-slate-500">
                Explore real-time occupancy status, power socket indicators, personal lockers, and transfer desks with zero race conditions.
              </p>
              <Link
                to="/study-room"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <span>Open 150-Seat Visualizer</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Desk Check-In & Attendance</h3>
              <p className="text-xs text-slate-500">
                Track daily student study hours with one-click check-in and check-out timestamps.
              </p>
              <Link
                to="/study-room"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700"
              >
                <span>Check-In / Out</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 5: STUDENT & PARENT */}
      {activePortal === 'STUDENT' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <h2 className="text-lg font-bold">Student & Parent 360° Portal</h2>
            <p className="text-sm text-blue-200">
              Complete visibility into academic enrollments, fee dues, attendance rates, exam scorecards, and campus facilities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">360° Comprehensive Profile</h3>
              <p className="text-xs text-slate-500">
                View all 11 centralized tabs covering academics, hostel, study room, attendance, exams, and ledger.
              </p>
              <Link
                to="/students"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>Inspect Student Profile</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Fee Invoices & Dues</h3>
              <p className="text-xs text-slate-500">
                Check installment payment deadlines, outstanding balance, and download verified electronic receipts.
              </p>
              <Link
                to="/fees"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <span>View Dues</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Assessment Scorecards</h3>
              <p className="text-xs text-slate-500">
                Review theory and practical marks, grades, and competitive negative marking results.
              </p>
              <Link
                to="/examinations"
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700"
              >
                <span>View Report Cards</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
