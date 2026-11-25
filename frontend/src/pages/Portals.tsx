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
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export const Portals: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === 'SUPER_ADMIN';
  const [activePortal, setActivePortal] = useState<'STUDENT' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN'>('STUDENT');

  const portalOptions = [
    { key: 'STUDENT', label: 'Student Self-Service Portal', icon: User },
    { key: 'PARENT', label: 'Parent Guardian Portal', icon: Users },
    { key: 'ADMIN', label: 'Admin Unified Operations Hub', icon: ShieldCheck },
    ...(isSuperAdmin ? [{ key: 'SUPER_ADMIN', label: 'Super Admin Master & Cashier Desk', icon: DollarSign }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Institute Portals & Access Gateway</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              4-Role RBAC Model • Strict Financial Shielding • Dedicated Student &amp; Parent Access
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 self-start md:self-auto flex items-center space-x-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          <span>Logged in as: <strong className="text-slate-900">{user?.first_name} {user?.last_name}</strong> ({user?.user_type})</span>
        </div>
      </div>

      {/* Role Navigation Pills */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        {portalOptions.map((p) => {
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

      {/* Portal 1: STUDENT */}
      {activePortal === 'STUDENT' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Student Self-Service View</span>
            </div>
            <h2 className="text-lg font-bold">Enrolled Student Personal Gateway</h2>
            <p className="text-sm text-blue-200">
              Students authenticate with PRN / Roll Number. Access is strictly scoped to their personal marks, attendance records, study seat, and hostel bed.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Academic Scorecards</h3>
              <p className="text-xs text-slate-500">
                View weekly unit tests, mock CET tests, subject percentage, and negative marking analytics.
              </p>
              <Link to="/examinations" className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700">
                <span>View Results</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Attendance History</h3>
              <p className="text-xs text-slate-500">
                Track personal monthly attendance percentage and daily present/absent logs.
              </p>
              <Link to="/attendance" className="inline-flex items-center space-x-1.5 text-xs font-bold text-teal-600 hover:text-teal-700">
                <span>View Attendance</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Hostel Bed & Study Seat</h3>
              <p className="text-xs text-slate-500">
                Check allocated room, upper/lower bunk berth number, and reserved 150-seat study hall desk.
              </p>
              <Link to="/students" className="inline-flex items-center space-x-1.5 text-xs font-bold text-blue-600 hover:text-blue-700">
                <span>View Allocation</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 2: PARENT */}
      {activePortal === 'PARENT' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-950 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <Users className="w-3.5 h-3.5" />
              <span>Parent / Guardian View</span>
            </div>
            <h2 className="text-lg font-bold">Parent Real-Time Monitoring Portal</h2>
            <p className="text-sm text-emerald-200">
              Parents authenticate using their Registered Mobile Number. Strictly locked to their child's progress, official fee receipts, and performance alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Fee Payment Receipts</h3>
              <p className="text-xs text-slate-500">
                Download timestamped electronic payment receipts and review installment schedules.
              </p>
              <div className="text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                ✓ Available via WhatsApp &amp; Parent Portal
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Official Scorecard Reports</h3>
              <p className="text-xs text-slate-500">
                Instant access to certified exam results and subject performance summaries.
              </p>
              <Link to="/examinations" className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700">
                <span>View Scorecards</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Attendance Notifications</h3>
              <p className="text-xs text-slate-500">
                Real-time absent alerts dispatched via Meta WhatsApp Cloud API and Brevo Email.
              </p>
              <Link to="/attendance" className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700">
                <span>View Roll Call</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Portal 3: ADMIN */}
      {activePortal === 'ADMIN' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-teal-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Unified Administrator Desk</span>
            </div>
            <h2 className="text-lg font-bold">Admin Campus Operations Command Center</h2>
            <p className="text-sm text-teal-200">
              Admin manages Teacher tasks (Attendance, Exams), Hostel Warden tasks (Beds, Rooms), Study Desk tasks (150 Seats), and Admissions — with zero financial access.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
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

      {/* Portal 4: SUPER_ADMIN */}
      {activePortal === 'SUPER_ADMIN' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 p-6 rounded-2xl text-white space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Sole Financial &amp; Cashier Authority</span>
            </div>
            <h2 className="text-lg font-bold">Super Admin Executive Desk (Owner)</h2>
            <p className="text-sm text-amber-200">
              Exclusive authority over all fee ledgers, tuition payments, installment schedules, cash receipts, and facility pricing plans.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
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
