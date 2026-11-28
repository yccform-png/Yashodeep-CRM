import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  CreditCard,
  Building2,
  Phone,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  CalendarDays,
  Percent,
  CheckCheck
} from 'lucide-react';
import apiClient from '../api/client';
import { useAcademicYear } from '../context/AcademicYearContext';
import { useInstitute } from '../context/InstituteContext';

interface FinanceOverview {
  selected_academic_year_id: string | null;
  selected_academic_year_name: string;
  gross_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  recovery_rate: number;
  invoices_count: {
    total: number;
    paid: number;
    partial: number;
    unpaid: number;
  };
  payment_methods: Array<{
    method: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  revenue_streams: Array<{
    code: string;
    label: string;
    amount: number;
    percentage: number;
  }>;
  multi_year_comparison: Array<{
    academic_year_id: string;
    year_name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    student_count: number;
    gross_invoiced: number;
    total_collected: number;
    total_outstanding: number;
    recovery_rate: number;
    yoy_growth: number;
  }>;
}

interface BatchFinance {
  batch_id: string;
  batch_name: string;
  batch_code: string;
  division: string;
  course_id: string;
  course_name: string;
  class_id: string | null;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  max_capacity: number;
  enrolled_count: number;
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  recovery_rate: number;
  fully_paid_students: number;
  partial_students: number;
  unpaid_students: number;
}

interface BatchStudentFinance {
  student_id: string;
  student_name: string;
  student_code: string;
  prn: string | null;
  guardian_name: string;
  guardian_mobile: string;
  invoices: Array<{
    invoice_id: string;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    status: string;
    issue_date: string;
    due_date: string;
  }>;
  total_billed: number;
  total_paid: number;
  balance_due: number;
  overdue_installments: Array<{
    installment_number: number;
    due_date: string;
    amount: number;
    pending_amount: number;
    days_overdue: number;
  }>;
}

interface DefaulterItem {
  installment_id: string;
  invoice_id: string;
  invoice_number: string;
  student_id: string;
  student_name: string;
  student_code: string;
  guardian_name: string;
  guardian_mobile: string;
  batch_name: string;
  batch_code: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  pending_amount: number;
  days_overdue: number;
  days_until_due?: number;
  is_overdue: boolean;
}

interface DefaultersData {
  summary: {
    upcoming_total: number;
    upcoming_count: number;
    b1_30_total: number;
    b1_30_count: number;
    b31_60_total: number;
    b31_60_count: number;
    b61_90_total: number;
    b61_90_count: number;
    b90_plus_total: number;
    b90_plus_count: number;
    total_overdue_amount: number;
    total_overdue_count: number;
  };
  buckets: {
    upcoming: DefaulterItem[];
    '1_30': DefaulterItem[];
    '31_60': DefaulterItem[];
    '61_90': DefaulterItem[];
    '90_plus': DefaulterItem[];
  };
}

export const FinanceAnalytics: React.FC = () => {
  const { academicYears, selectedAcademicYear, setSelectedAcademicYearById } = useAcademicYear();
  const { institute } = useInstitute();

  // Active Year Selection: 'ALL' or specific academic_year_id
  const [selectedYearId, setSelectedYearId] = useState<string>(selectedAcademicYear?.id || 'ALL');

  // Reactively sync with global academic year changes from Topbar
  useEffect(() => {
    if (selectedAcademicYear?.id) {
      setSelectedYearId(selectedAcademicYear.id);
    }
  }, [selectedAcademicYear?.id]);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'BATCHES' | 'STREAMS' | 'DEFAULTERS' | 'MULTI_YEAR'>('BATCHES');

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [batches, setBatches] = useState<BatchFinance[]>([]);
  const [defaulters, setDefaulters] = useState<DefaultersData | null>(null);

  // Batch Filter & Search
  const [batchSearchTerm, setBatchSearchTerm] = useState<string>('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

  // Batch Students Modal
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState<BatchFinance | null>(null);
  const [batchStudentsData, setBatchStudentsData] = useState<{ batch_name: string; students: BatchStudentFinance[] } | null>(null);
  const [loadingBatchStudents, setLoadingBatchStudents] = useState<boolean>(false);

  // Defaulter Aging Filter Bucket
  const [activeAgingBucket, setActiveAgingBucket] = useState<'ALL' | 'upcoming' | '1_30' | '31_60' | '61_90' | '90_plus'>('ALL');

  // Fetch all analytics data
  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      const params = selectedYearId !== 'ALL' ? { academic_year_id: selectedYearId } : {};

      const [overviewRes, batchRes, defaultersRes] = await Promise.all([
        apiClient.get<FinanceOverview>('/reports/finance/overview', { params }),
        apiClient.get<BatchFinance[]>('/reports/finance/batchwise', { params }),
        apiClient.get<DefaultersData>('/reports/finance/defaulters', { params })
      ]);

      setOverview(overviewRes.data);
      setBatches(batchRes.data);
      setDefaulters(defaultersRes.data);
    } catch (err) {
      console.error('Failed to load finance analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [selectedYearId]);

  // Open Batch Students Ledger Drilldown
  const handleOpenBatchStudents = async (batch: BatchFinance) => {
    try {
      setSelectedBatchForStudents(batch);
      setLoadingBatchStudents(true);
      const res = await apiClient.get<{ batch_name: string; students: BatchStudentFinance[] }>(
        '/reports/finance/batch-students',
        { params: { batch_id: batch.batch_id } }
      );
      setBatchStudentsData(res.data);
    } catch (err) {
      console.error('Failed to load batch student finances', err);
    } finally {
      setLoadingBatchStudents(false);
    }
  };

  // Export Batchwise Collection to CSV
  const exportBatchwiseToCSV = () => {
    if (!batches || batches.length === 0) return;
    const headers = [
      'Academic Year',
      'Class/Standard',
      'Course',
      'Batch Name',
      'Batch Code',
      'Division',
      'Enrolled Students',
      'Total Invoiced (INR)',
      'Total Collected (INR)',
      'Balance Due (INR)',
      'Recovery Rate (%)',
      'Fully Paid Students',
      'Partially Paid Students',
      'Unpaid Students'
    ];

    const rows = batches.map((b) => [
      `"${b.academic_year_name}"`,
      `"${b.class_name}"`,
      `"${b.course_name}"`,
      `"${b.batch_name}"`,
      `"${b.batch_code}"`,
      `"${b.division}"`,
      b.enrolled_count,
      b.total_invoiced.toFixed(2),
      b.total_collected.toFixed(2),
      b.total_outstanding.toFixed(2),
      b.recovery_rate,
      b.fully_paid_students,
      b.partial_students,
      b.unpaid_students
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Batchwise_Collection_Report_${selectedYearId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter batches by search & class
  const filteredBatches = batches.filter((b) => {
    if (selectedClassFilter !== 'ALL' && b.class_id !== selectedClassFilter) {
      return false;
    }
    if (batchSearchTerm.trim()) {
      const q = batchSearchTerm.toLowerCase();
      return (
        b.batch_name.toLowerCase().includes(q) ||
        b.batch_code.toLowerCase().includes(q) ||
        b.course_name.toLowerCase().includes(q) ||
        b.division.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Unique classes for filter pills
  const uniqueClasses = Array.from(new Set(batches.map((b) => JSON.stringify({ id: b.class_id, name: b.class_name }))))
    .map((str) => JSON.parse(str))
    .filter((c) => c.id !== null);

  // Filtered Defaulter Items based on active aging bucket
  const getFilteredDefaulters = () => {
    if (!defaulters) return [];
    if (activeAgingBucket === 'ALL') {
      return [
        ...defaulters.buckets['1_30'],
        ...defaulters.buckets['31_60'],
        ...defaulters.buckets['61_90'],
        ...defaulters.buckets['90_plus']
      ];
    }
    return defaulters.buckets[activeAgingBucket] || [];
  };

  // Batchwise Totals
  const totalBilledBatches = filteredBatches.reduce((acc, b) => acc + b.total_invoiced, 0);
  const totalCollectedBatches = filteredBatches.reduce((acc, b) => acc + b.total_collected, 0);
  const totalBalanceBatches = filteredBatches.reduce((acc, b) => acc + b.total_outstanding, 0);
  const totalEnrolledBatches = filteredBatches.reduce((acc, b) => acc + b.enrolled_count, 0);
  const avgRecoveryBatches = totalBilledBatches > 0 ? ((totalCollectedBatches / totalBilledBatches) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 w-full pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm w-full">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-600/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Finance &amp; Collections Intelligence
              </h1>
              <p className="text-xs text-slate-500">
                Batchwise realization, multi-year recovery trajectory, and real-time fee analysis.
              </p>
            </div>
          </div>
        </div>

        {/* Global Year Switcher & Quick Export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500 ml-1.5" />
            <select
              value={selectedYearId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedYearId(val);
                if (val !== 'ALL') {
                  setSelectedAcademicYearById(val);
                }
              }}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Academic Years (Multi-Year Trajectory)</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name} {ay.is_current ? '(Current Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchFinanceData}
            title="Reload financial data"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={exportBatchwiseToCSV}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* High-Level Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Gross Invoiced */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Billed (Invoiced)</span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹{(overview?.gross_invoiced || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Total across {overview?.invoices_count.total || 0} student fee billings
            </p>
          </div>
        </div>

        {/* Realized Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Realized Collections</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-700 font-mono tracking-tight">
              ₹{(overview?.total_collected || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, overview?.recovery_rate || 0)}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{overview?.recovery_rate || 0}% Realized</span>
              <span>{overview?.invoices_count.paid || 0} Paid in Full</span>
            </p>
          </div>
        </div>

        {/* Total Outstanding Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Net Outstanding Dues</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-700 font-mono tracking-tight">
              ₹{(overview?.total_outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {overview?.invoices_count.partial || 0} partially paid • {overview?.invoices_count.unpaid || 0} unpaid
            </p>
          </div>
        </div>

        {/* Defaulter / Overdue Radar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Overdue Defaulters</span>
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              ₹{(defaulters?.summary.total_overdue_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {defaulters?.summary.total_overdue_count || 0} overdue installments across student cohorts
            </p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation with Right Status Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 bg-white px-4 rounded-2xl shadow-sm gap-2">
        <div className="flex items-center space-x-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('BATCHES')}
            className={`flex items-center space-x-2 py-3.5 px-3 border-b-2 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'BATCHES'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Batchwise Collections ({batches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STREAMS')}
            className={`flex items-center space-x-2 py-3.5 px-3 border-b-2 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'STREAMS'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Revenue Streams &amp; Payment Modes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEFAULTERS')}
            className={`flex items-center space-x-2 py-3.5 px-3 border-b-2 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'DEFAULTERS'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Defaulters &amp; Cashflow Pipeline ({defaulters?.summary.total_overdue_count || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MULTI_YEAR')}
            className={`flex items-center space-x-2 py-3.5 px-3 border-b-2 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'MULTI_YEAR'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Multi-Year Comparison &amp; YoY Growth</span>
          </button>
        </div>

        {/* Right Status Indicator */}
        <div className="hidden lg:flex items-center space-x-2 py-2">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {overview?.recovery_rate || 0}% Realized
          </span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono">
            Balance Due: ₹{(overview?.total_outstanding || 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* TAB 1: BATCHWISE COLLECTIONS TABLE */}
      {activeTab === 'BATCHES' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 w-full">
          {/* Controls & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search batch name, code, division, or course..."
                value={batchSearchTerm}
                onChange={(e) => setBatchSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Class Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedClassFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  selectedClassFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Classes
              </button>
              {uniqueClasses.map((cl: any) => (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => setSelectedClassFilter(cl.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                    selectedClassFilter === cl.id
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Batches Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="py-3 px-4">Standard &amp; Batch Name</th>
                  <th className="py-3 px-3 text-center">Batch Code / Div</th>
                  <th className="py-3 px-3 text-center">Session</th>
                  <th className="py-3 px-3 text-center">Enrolled</th>
                  <th className="py-3 px-4 text-right">Gross Invoiced</th>
                  <th className="py-3 px-4 text-right">Total Collected</th>
                  <th className="py-3 px-4 text-right">Net Balance Due</th>
                  <th className="py-3 px-4 text-center">Recovery %</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-semibold">No classroom batches match your filter.</p>
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.batch_id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <span className="font-bold block text-sm">{b.batch_name}</span>
                        <span className="text-[11px] text-slate-500">{b.course_name}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {b.batch_code}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Div {b.division}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-600">
                        {b.academic_year_name}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                        {b.enrolled_count} <span className="text-[10px] text-slate-400 font-normal">/ {b.max_capacity}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        ₹{b.total_invoiced.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        ₹{b.total_collected.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                        ₹{b.total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                b.recovery_rate >= 80
                                  ? 'bg-emerald-600'
                                  : b.recovery_rate >= 50
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, b.recovery_rate)}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-700">
                            {b.recovery_rate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenBatchStudents(b)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs transition cursor-pointer inline-flex items-center space-x-1"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Student Ledger</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* Summary Totals Row */}
              {filteredBatches.length > 0 && (
                <tfoot className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-xs text-slate-900">
                  <tr>
                    <td className="py-3 px-4 font-black" colSpan={3}>
                      Total Across {filteredBatches.length} Displayed Batches
                    </td>
                    <td className="py-3 px-3 text-center font-black">
                      {totalEnrolledBatches}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black">
                      ₹{totalBilledBatches.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                      ₹{totalCollectedBatches.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-amber-700">
                      ₹{totalBalanceBatches.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      {avgRecoveryBatches}%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REVENUE STREAMS & PAYMENT MODES */}
      {activeTab === 'STREAMS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full">
          {/* Revenue Component Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Revenue Components</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                ₹{(overview?.gross_invoiced || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-3.5">
              {overview?.revenue_streams.map((stream) => (
                <div key={stream.code} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-800 font-bold">{stream.label}</span>
                    <span className="font-mono text-slate-700">
                      ₹{stream.amount.toLocaleString('en-IN')} ({stream.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, stream.percentage)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Payment Modes</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-700">
                ₹{(overview?.total_collected || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="space-y-3.5">
              {overview?.payment_methods && overview.payment_methods.length > 0 ? (
                overview.payment_methods.map((pm) => (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-800 font-bold uppercase tracking-wider">{pm.method.replace('_', ' ')}</span>
                      <span className="font-mono text-slate-700">
                        ₹{pm.amount.toLocaleString('en-IN')} • {pm.count} txns ({pm.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, pm.percentage)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No payment transactions logged in this session yet.
                </div>
              )}
            </div>
          </div>

          {/* Realization & Recovery Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Billing Recovery Matrix</h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700">
                {overview?.invoices_count.total || 0} Invoices
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">Fully Paid Invoices</span>
                  <span className="text-[11px] text-emerald-700">Zero arrears remaining</span>
                </div>
                <span className="text-lg font-black font-mono text-emerald-800">
                  {overview?.invoices_count.paid || 0}
                </span>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-900 block">Partially Paid Invoices</span>
                  <span className="text-[11px] text-blue-700">Installments ongoing</span>
                </div>
                <span className="text-lg font-black font-mono text-blue-800">
                  {overview?.invoices_count.partial || 0}
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 block">Unpaid / Issued Invoices</span>
                  <span className="text-[11px] text-amber-700">Full amount pending</span>
                </div>
                <span className="text-lg font-black font-mono text-amber-800">
                  {overview?.invoices_count.unpaid || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DEFAULTERS & UPCOMING PIPELINE */}
      {activeTab === 'DEFAULTERS' && (
        <div className="space-y-5 w-full">
          {/* Delinquency & Aging Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Installments &amp; Delinquency Aging Radar</h3>
                <p className="text-xs text-slate-500">
                  Overdue delinquent installments categorized by age, alongside upcoming scheduled cash inflows.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                  Total Overdue: ₹{(defaulters?.summary.total_overdue_amount || 0).toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                  Upcoming Pipeline: ₹{(defaulters?.summary.upcoming_total || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Aging & Pipeline Selector Tabs (6 Buckets) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { key: 'ALL', label: 'All Overdue', count: defaulters?.summary.total_overdue_count, total: defaulters?.summary.total_overdue_amount, badge: 'Overdue' },
                { key: 'upcoming', label: 'Upcoming Pipeline', count: defaulters?.summary.upcoming_count, total: defaulters?.summary.upcoming_total, badge: 'Scheduled' },
                { key: '1_30', label: '1–30 Days', count: defaulters?.summary.b1_30_count, total: defaulters?.summary.b1_30_total, badge: 'Mild' },
                { key: '31_60', label: '31–60 Days', count: defaulters?.summary.b31_60_count, total: defaulters?.summary.b31_60_total, badge: 'Moderate' },
                { key: '61_90', label: '61–90 Days', count: defaulters?.summary.b61_90_count, total: defaulters?.summary.b61_90_total, badge: 'High' },
                { key: '90_plus', label: '90+ Days Critical', count: defaulters?.summary.b90_plus_count, total: defaulters?.summary.b90_plus_total, badge: 'Severe' }
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setActiveAgingBucket(b.key as any)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    activeAgingBucket === b.key
                      ? 'bg-slate-50 ring-2 ring-emerald-500 shadow-xs'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 block truncate">{b.label}</span>
                  </div>
                  <span className="font-mono text-sm font-black block mt-1 text-slate-900 truncate">
                    ₹{(b.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">
                    {b.count || 0} installment(s)
                  </span>
                </button>
              ))}
            </div>

            {/* Overdue Delinquents Table (shown when activeAgingBucket is an overdue filter or ALL with > 0 overdue) */}
            {activeAgingBucket !== 'upcoming' && (defaulters?.summary.total_overdue_count || 0) > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-x-auto w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-rose-50/70 border-b border-rose-200 font-bold text-rose-900">
                    <tr>
                      <th className="py-2.5 px-4">Overdue Student &amp; Code</th>
                      <th className="py-2.5 px-3">Batch / Division</th>
                      <th className="py-2.5 px-3">Parent / Guardian Phone</th>
                      <th className="py-2.5 px-3 text-center">Invoice #</th>
                      <th className="py-2.5 px-3 text-center">Inst #</th>
                      <th className="py-2.5 px-3 text-center">Due Date</th>
                      <th className="py-2.5 px-4 text-right">Overdue Amount</th>
                      <th className="py-2.5 px-3 text-center">Days Overdue</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getFilteredDefaulters().map((item) => (
                      <tr key={item.installment_id} className="hover:bg-rose-50/40 transition">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <span className="font-bold block">{item.student_name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{item.student_code}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{item.batch_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          <span>{item.guardian_name}</span>
                          <span className="text-slate-500 block text-[11px]">{item.guardian_mobile}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                          {item.invoice_number}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">#{item.installment_number}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-600">{item.due_date}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                          ₹{item.pending_amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                            {item.days_overdue} days
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.guardian_mobile && item.guardian_mobile !== '—' && (
                            <a
                              href={`https://wa.me/91${item.guardian_mobile.replace(/\D/g, '')}?text=Dear%20Parent,%20installment%20of%20Rs.${item.pending_amount}%20for%20${item.student_name}%20is%20overdue.%20Please%20pay%20promptly.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg inline-flex items-center transition cursor-pointer"
                              title="Send WhatsApp Reminder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Zero Overdue Health Banner (shown when total overdue is 0) */}
            {activeAgingBucket !== 'upcoming' && (defaulters?.summary.total_overdue_count || 0) === 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg">
                    <CheckCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Zero Overdue Delinquencies</h4>
                    <p className="text-[11px] text-emerald-700">
                      All student accounts in this academic session are on-schedule with no overdue arrears.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-white text-emerald-800 rounded-lg border border-emerald-300 font-mono">
                  100% On-Schedule
                </span>
              </div>
            )}
          </div>

          {/* Upcoming Installments Cashflow Pipeline (Always occupies the space with vital forecast data!) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Upcoming Cashflow Realization Pipeline</h3>
                  <p className="text-xs text-slate-500">
                    Scheduled future installments and expected revenue timeline.
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
                Pipeline Total: ₹{(defaulters?.summary.upcoming_total || 0).toLocaleString('en-IN')} • {defaulters?.summary.upcoming_count || 0} scheduled
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-4">Student Name &amp; Code</th>
                    <th className="py-2.5 px-3">Batch / Standard</th>
                    <th className="py-2.5 px-3">Parent Contact</th>
                    <th className="py-2.5 px-3 text-center">Invoice #</th>
                    <th className="py-2.5 px-3 text-center">Inst #</th>
                    <th className="py-2.5 px-3 text-center">Scheduled Due Date</th>
                    <th className="py-2.5 px-4 text-right">Expected Amount</th>
                    <th className="py-2.5 px-3 text-center">Timeline</th>
                    <th className="py-2.5 px-3 text-center">Notify</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {defaulters?.buckets.upcoming && defaulters.buckets.upcoming.length > 0 ? (
                    defaulters.buckets.upcoming.map((item) => (
                      <tr key={item.installment_id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <span className="font-bold block">{item.student_name}</span>
                          <span className="font-mono text-[10px] text-slate-500">{item.student_code}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{item.batch_name}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          <span>{item.guardian_name}</span>
                          <span className="text-slate-500 block text-[11px]">{item.guardian_mobile}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-700">
                          {item.invoice_number}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">#{item.installment_number}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {item.due_date}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          ₹{item.pending_amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                            {item.days_until_due !== undefined ? `In ${item.days_until_due}d` : 'Upcoming'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {item.guardian_mobile && item.guardian_mobile !== '—' && (
                            <a
                              href={`https://wa.me/91${item.guardian_mobile.replace(/\D/g, '')}?text=Dear%20Parent,%20installment%20of%20Rs.${item.pending_amount}%20for%20${item.student_name}%20is%20scheduled%20due%20on%20${item.due_date}.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg inline-flex items-center transition cursor-pointer"
                              title="Send Advance Schedule Reminder"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No upcoming installments scheduled for this session.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-YEAR COMPARISON & YOY GROWTH */}
      {activeTab === 'MULTI_YEAR' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 w-full">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Multi-Year Trajectory &amp; Year-over-Year Growth</h3>
              <p className="text-xs text-slate-500">Historical financial trends and intake progression across academic cycles.</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="py-3 px-4">Academic Session</th>
                  <th className="py-3 px-3 text-center">Session Period</th>
                  <th className="py-3 px-3 text-center">Total Students</th>
                  <th className="py-3 px-4 text-right">Gross Invoiced</th>
                  <th className="py-3 px-4 text-right">Total Realized</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Recovery %</th>
                  <th className="py-3 px-4 text-center">YoY Revenue Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview?.multi_year_comparison.map((ay) => (
                  <tr key={ay.academic_year_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {ay.year_name} {ay.is_current && <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">Active Session</span>}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono text-[11px] text-slate-500">
                      {ay.start_date} to {ay.end_date}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                      {ay.student_count}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{ay.gross_invoiced.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                      ₹{ay.total_collected.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                      ₹{ay.total_outstanding.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold">
                      {ay.recovery_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {ay.yoy_growth !== 0 ? (
                        <span className={`inline-flex items-center space-x-0.5 font-bold font-mono text-[11px] px-2 py-0.5 rounded-full ${
                          ay.yoy_growth > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {ay.yoy_growth > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          <span>{ay.yoy_growth}%</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">— Base Year</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BATCH STUDENT LEDGER MODAL */}
      {selectedBatchForStudents && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold tracking-tight">
                  {selectedBatchForStudents.batch_name} — Student Fee Ledgers
                </h3>
                <p className="text-xs text-slate-400">
                  Code: {selectedBatchForStudents.batch_code} • {selectedBatchForStudents.academic_year_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatchForStudents(null);
                  setBatchStudentsData(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {loadingBatchStudents ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs font-semibold">Loading batch student invoices...</p>
                </div>
              ) : batchStudentsData?.students.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-xs">No students currently enrolled in this batch.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <tr>
                        <th className="py-2.5 px-4">Student</th>
                        <th className="py-2.5 px-3">Parent Contact</th>
                        <th className="py-2.5 px-3 text-right">Billed</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Overdue Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchStudentsData?.students.map((stu) => (
                        <tr key={stu.student_id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <span className="font-bold block">{stu.student_name}</span>
                            <span className="font-mono text-[10px] text-slate-500">{stu.student_code}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            <span>{stu.guardian_name}</span>
                            <span className="block text-[11px] text-slate-500">{stu.guardian_mobile}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{stu.total_billed.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{stu.total_paid.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                            ₹{stu.balance_due.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {stu.balance_due === 0 ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                FULLY PAID
                              </span>
                            ) : stu.total_paid > 0 ? (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                                PARTIAL
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-50 text-rose-700 border border-rose-200">
                                UNPAID
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {stu.overdue_installments.length > 0 ? (
                              <span className="text-[11px] font-bold text-rose-600">
                                {stu.overdue_installments.length} installment(s) overdue
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-600 font-semibold">No arrears</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinanceAnalytics;
