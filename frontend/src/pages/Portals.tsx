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
  ShieldCheck,
  Clock,
  ArrowRight,
  Shield,
  Smartphone,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const Portals: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === 'SUPER_ADMIN';
  const isAdmin = user?.user_type === 'ADMIN';
  const isStudent = user?.user_type === 'STUDENT';
  const isParent = user?.user_type === 'PARENT';
  const isStaff = isSuperAdmin || isAdmin;

  const defaultPortal = isParent ? 'PARENT' : isStudent ? 'STUDENT' : isAdmin ? 'ADMIN' : 'SUPER_ADMIN';
  const [activePortal, setActivePortal] = useState<'STUDENT' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN'>(defaultPortal);

  // Role-filtered portal tabs
  const portalOptions = isStaff
    ? [
        { key: 'ADMIN', label: 'Admin Unified Operations Hub', icon: ShieldCheck },
        ...(isSuperAdmin ? [{ key: 'SUPER_ADMIN', label: 'Super Admin Executive Desk', icon: DollarSign }] : []),
        { key: 'STUDENT', label: 'Student Self-Service Preview', icon: User },
        { key: 'PARENT', label: 'Parent Portal Preview', icon: Users },
      ]
    : isParent
    ? [{ key: 'PARENT', label: 'Parent Guardian Portal', icon: Users }]
    : [{ key: 'STUDENT', label: 'Student Self-Service Portal', icon: User }];

  const studentDossierPath = user?.student_id ? `/students/${user.student_id}` : '/portals';

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            {isStaff ? <Layers className="w-6 h-6" /> : <GraduationCap className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              {isStudent
                ? 'Student Self-Service Portal'
                : isParent
                ? 'Parent & Guardian Monitoring Portal'
                : 'Institute Portals & Access Gateway'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              {isStudent
                ? 'Your personal academic records, daily attendance, examination scorecards, and accommodation details.'
                : isParent
                ? 'Real-time performance alerts, attendance ledger, hostel status, and verified fee receipts for your ward.'
                : '4-Role RBAC Model • Strict Financial Shielding • Dedicated Student & Parent Gateways'}
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 self-start md:self-auto flex items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            Signed in as: <strong className="text-slate-900">{user?.first_name} {user?.last_name}</strong> ({user?.user_type})
          </span>
        </div>
      </div>

      {/* Role Navigation Pills (Only shown to staff when multiple views are available) */}
      {isStaff && portalOptions.length > 1 && (
        <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
          {portalOptions.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => setActivePortal(p.key as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition-all whitespace-nowrap cursor-pointer ${
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
      )}

      {/* ========================================================================= */}
      {/* PORTAL 1: STUDENT */}
      {/* ========================================================================= */}
      {(activePortal === 'STUDENT' || isStudent) && (
        <div className="space-y-6">
          {/* Student Welcome Hero Card */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-7 rounded-2xl text-white space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Enrolled Student Workspace</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Welcome, {user?.first_name} {user?.last_name}!
                </h2>
                <p className="text-xs sm:text-sm text-blue-200 max-w-2xl leading-relaxed">
                  Your academic home at Yashodeep Coaching Classes. Track your live lecture attendance, inspect test scorecards, verify hostel berth allocations, and download official fee receipts anytime.
                </p>
              </div>

              {user?.student_id && (
                <Link
                  to={`/students/${user.student_id}`}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition shrink-0 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Launch My Full Dossier</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Student Quick Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: My Profile & Curriculum */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-blue-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Curriculum &amp; Batch</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Enrolled courses, active batch schedule, teacher assignments, and syllabus progress.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=academics`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 pt-2 border-t border-slate-100"
              >
                <span>View Curriculum</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 2: Attendance Roll Call */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-teal-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Attendance History</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Daily classroom roll call, monthly turnout percentage, and present/absent session logs.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=attendance`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 pt-2 border-t border-slate-100"
              >
                <span>Check Attendance</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 3: Exam Scorecards */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-purple-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Exam Scorecards</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Weekly unit tests, mock CET scores, subject marks breakdown, and class standings.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=examinations`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 pt-2 border-t border-slate-100"
              >
                <span>View Scorecards</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 4: Hostel & Study Hall */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-amber-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Hostel &amp; Study Hall</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Allocated residential bunk bed, room sequence number, and reserved study desk allocation.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=hostel`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 pt-2 border-t border-slate-100"
              >
                <span>View Facilities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PORTAL 2: PARENT */}
      {/* ========================================================================= */}
      {(activePortal === 'PARENT' || isParent) && !isStudent && (
        <div className="space-y-6">
          {/* Parent Welcome Hero Card */}
          <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 p-6 sm:p-7 rounded-2xl text-white space-y-4 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>Parent &amp; Guardian Gateway</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Welcome, {user?.first_name} {user?.last_name}!
                </h2>
                <p className="text-xs sm:text-sm text-emerald-200 max-w-2xl leading-relaxed">
                  Monitor your child's academic development in real time. Inspect daily attendance records, weekly test scorecards, and access official fee receipts with dual-copy verification.
                </p>
              </div>

              {user?.student_id && (
                <Link
                  to={`/students/${user.student_id}`}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 transition shrink-0 cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>View Ward Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Parent Action Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Attendance */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-emerald-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Turnout &amp; Roll Call</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Turnout statistics, present days, absent records, and automated absence notifications.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=attendance`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700 pt-2 border-t border-slate-100"
              >
                <span>View Roll Call</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 2: Exam Scorecards */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-purple-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Scorecards &amp; Marks</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Official test marks, subject percentages, chapter-wise evaluations, and teacher remarks.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=examinations`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 pt-2 border-t border-slate-100"
              >
                <span>View Scorecards</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 3: Fee Receipts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-emerald-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Official Fee Receipts</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Download certified electronic payment receipts with stamp and review installment schedules.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=payments`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 pt-2 border-t border-slate-100"
              >
                <span>Download Receipts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Card 4: Hostel & Study Hall */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between hover:border-amber-300 transition">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Home className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Campus Accommodations</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hostel room number, assigned bunk bed tier, and 150-seat study hall desk reservations.
                </p>
              </div>
              <Link
                to={`${studentDossierPath}?tab=hostel`}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 pt-2 border-t border-slate-100"
              >
                <span>View Facilities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PORTAL 3: ADMIN UNIFIED OPERATIONS (STAFF ONLY) */}
      {/* ========================================================================= */}
      {activePortal === 'ADMIN' && isStaff && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-6 rounded-2xl text-white space-y-2 shadow-sm">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Unified Administrator Desk</span>
            </div>
            <h2 className="text-lg font-bold">Admin Campus Operations Command Center</h2>
            <p className="text-sm text-teal-200">
              Admin manages Teacher tasks (Attendance, Exams), Hostel Warden tasks (Beds, Rooms), Study Desk tasks (150 Seats), and Admissions — with zero financial access.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Attendance (Teacher Duty)</h3>
              <p className="text-xs text-slate-500">Record batch attendance with 1-tap toggles and topic logs.</p>
              <Link to="/attendance" className="inline-flex items-center space-x-1 text-xs font-bold text-teal-600 hover:text-teal-700">
                <span>Mark Roll Call</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Exams (Faculty Duty)</h3>
              <p className="text-xs text-slate-500">Input student test marks, calculate % and send scorecards.</p>
              <Link to="/examinations" className="inline-flex items-center space-x-1 text-xs font-bold text-purple-600 hover:text-purple-700">
                <span>Enter Marks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Home className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Hostel (Warden Duty)</h3>
              <p className="text-xs text-slate-500">Manage 2-tier double bunk berths, transfers, and room seq.</p>
              <Link to="/hostel" className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700">
                <span>Manage Beds</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Armchair className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Study Room (Desk Duty)</h3>
              <p className="text-xs text-slate-500">150-seat visualizer with Morning, Evening, and Full-Day shifts.</p>
              <Link to="/study-room" className="inline-flex items-center space-x-1 text-xs font-bold text-amber-600 hover:text-amber-700">
                <span>Allocate Desks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PORTAL 4: SUPER_ADMIN (OWNER ONLY) */}
      {/* ========================================================================= */}
      {activePortal === 'SUPER_ADMIN' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-6 rounded-2xl text-white space-y-2 shadow-sm">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Sole Financial &amp; Cashier Authority</span>
            </div>
            <h2 className="text-lg font-bold">Super Admin Executive Desk (Owner)</h2>
            <p className="text-sm text-amber-200">
              Exclusive authority over all fee ledgers, tuition payments, installment schedules, cash receipts, and facility pricing plans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Dynamic Fee Engine</h3>
              <p className="text-xs text-slate-500">
                Collect fee payments, issue numbered receipts, record bank transactions, and restructure installments.
              </p>
              <Link to="/fees" className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700">
                <span>Open Fee Engine</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Fee WhatsApp Reminders</h3>
              <p className="text-xs text-slate-500">
                Trigger 1-click WhatsApp payment reminders with dynamic installment amounts to parents.
              </p>
              <Link to="/fees" className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700">
                <span>Send Reminders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Institute Settings & Pricing</h3>
              <p className="text-xs text-slate-500">
                Configure facility plans, course package fees, institute profile, and manage admin credentials.
              </p>
              <Link to="/facility-plans" className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-700 hover:text-slate-900">
                <span>Configure Pricing</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portals;
