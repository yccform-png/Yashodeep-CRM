import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Armchair,
  Home,
  UserPlus,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const study = data?.study_room || { total_seats: 150, occupied_seats: 0, available_seats: 150, occupancy_rate: 0 };
  const hostel = data?.hostel || { total_beds: 10, occupied_beds: 0, available_beds: 10, occupancy_rate: 0 };

  return (
    <div className="space-y-6 w-full">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800 text-white shadow-sm">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Institute Operational Overview</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time status of admissions, fees, study room seats and residential hostel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:space-x-3">
          <Link
            to="/admissions"
            className="inline-flex items-center justify-center space-x-2 px-3.5 sm:px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl transition shadow-lg shadow-emerald-500/10 flex-1 sm:flex-none whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>New Admission Wizard</span>
          </Link>
          <Link
            to="/fees"
            className="inline-flex items-center justify-center space-x-2 px-3.5 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition flex-1 sm:flex-none whitespace-nowrap"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Collect Fee</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Students</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{data?.active_students || 0}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total Registered: <strong className="text-slate-700">{data?.total_students || 0}</strong></p>
        </div>

        {/* Total Fee Collections */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Collections</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">₹{(data?.total_collections || 0).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>Invoiced: ₹{(data?.total_invoiced || 0).toLocaleString('en-IN')}</span>
          </p>
        </div>

        {/* Outstanding Dues */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Outstanding Dues</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-3">₹{(data?.total_outstanding || 0).toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-slate-500 mt-1">Pending student balances</p>
        </div>

        {/* Study Room Occupancy */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Study Room (150 Seats)</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Armchair className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{study.occupied_seats} <span className="text-xs font-normal text-slate-400">/ 150</span></p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, study.occupancy_rate)}%` }}></div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">{study.occupancy_rate}% occupied ({study.available_seats} vacant)</p>
        </div>
      </div>

      {/* Facilities Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Study Room 150-Seat Quick Summary */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Study Room Inventory Status</h3>
              <p className="text-xs text-slate-500">105 Boys Desks (B001-B105) & 45 Girls Desks (G001-G045)</p>
            </div>
            <Link to="/study-room" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center space-x-1">
              <span>View Floor Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center mb-4">
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Capacity</p>
              <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1">150</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] sm:text-xs text-emerald-700 font-medium">Available</p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 sm:mt-1">{study.available_seats}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-rose-50 rounded-lg border border-rose-100">
              <p className="text-[10px] sm:text-xs text-rose-700 font-medium">Occupied</p>
              <p className="text-base sm:text-lg font-bold text-rose-700 mt-0.5 sm:mt-1">{study.occupied_seats}</p>
            </div>
          </div>
        </div>

        {/* Hostel Capacity Summary */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Hostel Residence Status</h3>
              <p className="text-xs text-slate-500">Boys &amp; Girls residential blocks</p>
            </div>
            <Link to="/hostel" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center space-x-1">
              <span>Hostel Manager</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center mb-4">
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Total Beds</p>
              <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1">{hostel.total_beds}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-[10px] sm:text-xs text-emerald-700 font-medium">Vacant Beds</p>
              <p className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 sm:mt-1">{hostel.available_beds}</p>
            </div>
            <div className="p-2.5 sm:p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-[10px] sm:text-xs text-blue-700 font-medium">Residents</p>
              <p className="text-base sm:text-lg font-bold text-blue-700 mt-0.5 sm:mt-1">{hostel.occupied_beds}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Admissions & Payments Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Admissions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">Recent Admissions</h3>
            <Link to="/students" className="text-xs text-emerald-600 hover:underline">View All</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data?.recent_admissions?.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No student admissions recorded yet.</p>
            ) : (
              data?.recent_admissions?.map((s: any) => (
                <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                      {s.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-400">{s.code} • {s.gender}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {s.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">Recent Fee Payments</h3>
            <Link to="/fees" className="text-xs text-emerald-600 hover:underline">View Ledger</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data?.recent_payments?.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-400">No payment transactions recorded yet.</p>
            ) : (
              data?.recent_payments?.map((p: any) => (
                <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">₹{p.amount.toLocaleString('en-IN')}</p>
                      <p className="text-[11px] text-slate-400">{p.payment_number} • {p.method}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                      {p.status}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.date}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
