import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Receipt,
  CreditCard,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  Printer,
  ChevronRight,
  TrendingUp,
  FileText,
  Building2,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers,
  GraduationCap,
  Users,
  BookOpen
} from 'lucide-react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { InvoiceDetailModal } from '../components/InvoiceDetailModal';
import { PaymentReceiptModal } from '../components/PaymentReceiptModal';

interface InvoiceItem {
  id: string;
  item_type: string;
  description: string;
  amount: number;
}

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_amount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

interface Invoice {
  id: string;
  student_id: string;
  student_name?: string;
  student_prn?: string;
  student_code?: string;
  student_mobile?: string;
  class_id?: string | null;
  class_name?: string | null;
  batch_id?: string | null;
  batch_name?: string | null;
  course_name?: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  items: InvoiceItem[];
  installments: Installment[];
}

interface ClassItem {
  id: string;
  name: string;
  code: string;
}

interface BatchItem {
  id: string;
  name: string;
  code: string;
  division: string;
  course_id: string;
}

interface CourseItem {
  id: string;
  name: string;
  class_id?: string;
}

interface PaymentRecord {
  id: string;
  student_id: string;
  payment_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_reference?: string | null;
  status: string;
  receipt_number: string;
  allocations: {
    invoice_id: string;
    installment_id?: string | null;
    allocated_amount: number;
  }[];
}

interface StudentOption {
  id: string;
  student_code?: string;
  prn?: string;
  first_name: string;
  last_name: string;
}

export const FeesManagement: React.FC = () => {
  const { hasRole } = useAuth();
  const canReschedule = hasRole(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT']);
  const canRestructure = hasRole(['SUPER_ADMIN', 'ADMIN']);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Record<string, StudentOption>>({});
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLE' | 'BATCH_ROLLUP'>('TABLE');
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [generatedReceipt, setGeneratedReceipt] = useState<PaymentRecord | null>(null);

  // Reschedule single installment state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [rescheduleParentInvoice, setRescheduleParentInvoice] = useState<Invoice | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Parent requested extension');
  const [rescheduling, setRescheduling] = useState(false);

  // Restructure Payment Plan state
  const [restructureModalOpen, setRestructureModalOpen] = useState(false);
  const [restructureParentInvoice, setRestructureParentInvoice] = useState<Invoice | null>(null);
  const [restructureCount, setRestructureCount] = useState(2);
  const [restructureInstallments, setRestructureInstallments] = useState<{ installment_number: number; due_date: string; amount: number }[]>([]);
  const [restructureReason, setRestructureReason] = useState('Parent requested installment restructuring');
  const [restructuring, setRestructuring] = useState(false);
  const [restructureError, setRestructureError] = useState<string | null>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('ONLINE_UPI');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const buildRestructureSchedule = (count: number, remainingBalance: number) => {
    const list = [];
    const baseAmount = Math.floor(remainingBalance / count);
    let runningTotal = 0;
    const today = new Date();
    for (let i = 1; i <= count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + (i - 1) * 30);
      const amt = i === count ? Number((remainingBalance - runningTotal).toFixed(2)) : baseAmount;
      runningTotal += amt;
      list.push({
        installment_number: i,
        due_date: d.toISOString().split('T')[0],
        amount: amt
      });
    }
    return list;
  };

  const openRestructureModal = (inv: Invoice) => {
    setRestructureParentInvoice(inv);
    setRestructureError(null);
    const count = 2;
    setRestructureCount(count);
    setRestructureInstallments(buildRestructureSchedule(count, Number(inv.balance_amount)));
    setRestructureReason('Parent requested installment restructuring');
    setRestructureModalOpen(true);
  };

  const handleRestructureCountChange = (count: number) => {
    if (!restructureParentInvoice) return;
    setRestructureCount(count);
    setRestructureInstallments(buildRestructureSchedule(count, Number(restructureParentInvoice.balance_amount)));
  };

  const handleRestructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restructureParentInvoice) return;
    const sum = restructureInstallments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const expected = Number(restructureParentInvoice.balance_amount);
    if (Math.abs(sum - expected) > 0.05) {
      setRestructureError(`Total of installments (₹${sum.toLocaleString('en-IN')}) must equal remaining balance (₹${expected.toLocaleString('en-IN')})`);
      return;
    }
    setRestructuring(true);
    setRestructureError(null);
    try {
      await apiClient.post(`/fees/invoices/${restructureParentInvoice.id}/restructure`, {
        number_of_installments: restructureCount,
        installments: restructureInstallments.map((i) => ({
          installment_number: i.installment_number,
          due_date: i.due_date,
          amount: Number(i.amount)
        })),
        reason: restructureReason.trim() || 'Parent requested installment restructuring'
      });
      setFeedback({ type: 'success', text: `Invoice #${restructureParentInvoice.invoice_number} successfully restructured into ${restructureCount} installments.` });
      setRestructureModalOpen(false);
      fetchInvoices();
    } catch (err: any) {
      setRestructureError(err.response?.data?.detail || 'Failed to restructure payment plan');
    } finally {
      setRestructuring(false);
    }
  };

  const openRescheduleModal = (inv: Invoice, inst: Installment) => {
    setRescheduleParentInvoice(inv);
    setSelectedInstallment(inst);
    setNewDueDate(inst.due_date);
    setRescheduleReason('Parent requested extension');
    setRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstallment) return;
    setRescheduling(true);
    try {
      await apiClient.patch(`/fees/installments/${selectedInstallment.id}/reschedule`, {
        new_due_date: newDueDate,
        reason: rescheduleReason
      });
      setFeedback({ type: 'success', text: `Installment #${selectedInstallment.installment_number} rescheduled to ${newDueDate}` });
      setRescheduleModalOpen(false);
      fetchInvoices();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to reschedule installment';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setRescheduling(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'ALL') params.status_filter = statusFilter;
      if (selectedClassId !== 'ALL') params.class_id = selectedClassId;
      if (selectedBatchId !== 'ALL') params.batch_id = selectedBatchId;
      const res = await apiClient.get<Invoice[]>('/fees/invoices', { params });
      setInvoices(res.data);
    } catch (err: any) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await apiClient.get<StudentOption[]>('/students', { params: { limit: 1000 } });
      const map: Record<string, StudentOption> = {};
      res.data.forEach((s) => {
        map[s.id] = s;
      });
      setStudents(map);
    } catch (err: any) {
      console.error('Failed to load student directory', err);
    }
  };

  const fetchAcademicData = async () => {
    try {
      const [clsRes, batchRes, crsRes] = await Promise.all([
        apiClient.get<ClassItem[]>('/academics/classes'),
        apiClient.get<BatchItem[]>('/academics/batches'),
        apiClient.get<CourseItem[]>('/academics/courses')
      ]);
      setClasses(clsRes.data || []);
      setBatches(batchRes.data || []);
      setCourses(crsRes.data || []);
    } catch (err: any) {
      console.error('Failed to load academic master data', err);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchStudents();
    fetchAcademicData();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, selectedClassId, selectedBatchId]);

  const openPaymentForInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    // Sort installments ascending to guarantee sequential allocation from #1 upwards
    const sortedInsts = [...(inv.installments || [])].sort((a, b) => a.installment_number - b.installment_number);
    const nextUnpaidInst = sortedInsts.find((i) => i.status !== 'PAID');
    if (nextUnpaidInst) {
      setPaymentAmount(nextUnpaidInst.amount - nextUnpaidInst.paid_amount);
    } else {
      setPaymentAmount(inv.balance_amount);
    }
    setTransactionRef(`TXN-${Date.now().toString().slice(-6)}`);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setActionLoading(true);
    setFeedback(null);

    try {
      // Find lowest unpaid installment in chronological order
      const sortedInsts = [...(selectedInvoice.installments || [])].sort((a, b) => a.installment_number - b.installment_number);
      const nextUnpaidInst = sortedInsts.find((i) => i.status !== 'PAID');

      const payload = {
        student_id: selectedInvoice.student_id,
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        transaction_reference: transactionRef || undefined,
        notes: paymentNotes || 'Fee counter collection',
        allocations: [
          {
            invoice_id: selectedInvoice.id,
            installment_id: nextUnpaidInst ? nextUnpaidInst.id : undefined,
            allocated_amount: Number(paymentAmount)
          }
        ]
      };

      const res = await apiClient.post<PaymentRecord>('/fees/payments', payload);
      setGeneratedReceipt(res.data);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      setFeedback({ type: 'success', text: `Payment recorded! Official Receipt #${res.data.receipt_number} issued.` });
      await fetchInvoices();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to record payment.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Cascading batches for selected class
  const availableBatches = React.useMemo(() => {
    if (selectedClassId === 'ALL') return batches;
    const classCourseIds = new Set(
      courses.filter((c) => c.class_id === selectedClassId).map((c) => c.id)
    );
    return batches.filter((b) => classCourseIds.has(b.course_id));
  }, [batches, courses, selectedClassId]);

  // Filtered invoices
  const filteredInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      // Class filter
      if (selectedClassId !== 'ALL' && inv.class_id && inv.class_id !== selectedClassId) return false;
      // Batch filter
      if (selectedBatchId !== 'ALL' && inv.batch_id && inv.batch_id !== selectedBatchId) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const invNum = inv.invoice_number.toLowerCase();
        const student = students[inv.student_id];
        const stuName = (inv.student_name || (student ? `${student.first_name} ${student.last_name}` : '')).toLowerCase();
        const stuPrn = (inv.student_prn || student?.prn || '').toLowerCase();
        const stuCode = (inv.student_code || student?.student_code || '').toLowerCase();
        const bName = (inv.batch_name || '').toLowerCase();
        const cName = (inv.class_name || '').toLowerCase();
        if (
          !invNum.includes(q) &&
          !stuName.includes(q) &&
          !stuPrn.includes(q) &&
          !stuCode.includes(q) &&
          !bName.includes(q) &&
          !cName.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, selectedClassId, selectedBatchId, searchQuery, students]);

  // Dynamic Metrics
  const isFiltered = selectedClassId !== 'ALL' || selectedBatchId !== 'ALL' || statusFilter !== 'ALL' || !!searchQuery.trim();
  const selectedClassName = classes.find((c) => c.id === selectedClassId)?.name;
  const selectedBatchName = batches.find((b) => b.id === selectedBatchId)?.name;

  const totalBilled = filteredInvoices.reduce((acc, inv) => acc + Number(inv.total_amount), 0);
  const totalCollected = filteredInvoices.reduce((acc, inv) => acc + Number(inv.paid_amount), 0);
  const totalOutstanding = filteredInvoices.reduce((acc, inv) => acc + Number(inv.balance_amount), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Batch Rollup Summary Calculation
  const batchRollupList = React.useMemo(() => {
    const map = new Map<string, {
      batchId: string;
      batchName: string;
      className: string;
      courseName: string;
      invoices: Invoice[];
      totalBilled: number;
      totalCollected: number;
      totalBalanceDue: number;
      overdueCount: number;
    }>();

    filteredInvoices.forEach((inv) => {
      const key = inv.batch_id || 'UNASSIGNED';
      const bName = inv.batch_name || 'Direct Admissions / Unassigned Batch';
      const cName = inv.class_name || 'General Standard';
      const crsName = inv.course_name || 'Academic Program';

      if (!map.has(key)) {
        map.set(key, {
          batchId: key,
          batchName: bName,
          className: cName,
          courseName: crsName,
          invoices: [],
          totalBilled: 0,
          totalCollected: 0,
          totalBalanceDue: 0,
          overdueCount: 0
        });
      }

      const entry = map.get(key)!;
      entry.invoices.push(inv);
      entry.totalBilled += Number(inv.total_amount);
      entry.totalCollected += Number(inv.paid_amount);
      entry.totalBalanceDue += Number(inv.balance_amount);
      if (inv.status === 'OVERDUE') {
        entry.overdueCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.batchId === 'UNASSIGNED') return 1;
      if (b.batchId === 'UNASSIGNED') return -1;
      return a.batchName.localeCompare(b.batchName);
    });
  }, [filteredInvoices]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dynamic Fee Engine & Invoicing</h1>
            <p className="text-sm text-slate-500">
              Automated Invoices • Installments • Double-Charge Prevention • Official Receipts & Ledger
            </p>
          </div>
        </div>

        <button
          onClick={fetchInvoices}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Invoices</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Filter Indicator Badge */}
      {isFiltered && (
        <div className="flex items-center gap-2 p-3 px-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex-wrap shadow-2xs">
          <Filter className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="font-semibold text-slate-700">Active Financial Scope:</span>
          {selectedClassId !== 'ALL' && (
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-purple-200 font-bold text-purple-800 shadow-2xs">
              Class: {selectedClassName || 'Selected'}
            </span>
          )}
          {selectedBatchId !== 'ALL' && (
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-blue-200 font-bold text-blue-800 shadow-2xs">
              Batch: {selectedBatchName || 'Selected'}
            </span>
          )}
          {statusFilter !== 'ALL' && (
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 font-bold text-emerald-800 shadow-2xs">
              Status: {statusFilter.replace('_', ' ')}
            </span>
          )}
          {searchQuery.trim() && (
            <span className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 shadow-2xs">
              Search: "{searchQuery}"
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedClassId('ALL');
              setSelectedBatchId('ALL');
              setStatusFilter('ALL');
              setSearchQuery('');
            }}
            className="ml-auto text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isFiltered ? 'Total Billed (Filtered)' : 'Total Billed (AY 2026-27)'}
            </p>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">₹{totalBilled.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">{filteredInvoices.length} Matching Invoices</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Revenue Realized</p>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-600">₹{totalCollected.toLocaleString('en-IN')}</p>
          <div className="mt-2 flex items-center space-x-2">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5" style={{ width: `${collectionRate}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-600">{collectionRate}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Receivables</p>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-600">₹{totalOutstanding.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-1">Pending student balances</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Academic Batch Scope</p>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex flex-col justify-between">
            <p className="text-sm font-bold text-slate-900">
              {selectedBatchId !== 'ALL'
                ? selectedBatchName
                : selectedClassId !== 'ALL'
                ? `${selectedClassName} (${availableBatches.length} Batches)`
                : `All Standards (${classes.length} Classes, ${batches.length} Batches)`}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Multi-class tuition &amp; EMI tracking</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Mode Switcher */}
      <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        {/* Row 1: View Mode Switcher & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoice Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('BATCH_ROLLUP')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'BATCH_ROLLUP'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Batch Analytics &amp; Rollup</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-auto md:min-w-[280px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice #, student name, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 2: Status Pills + Class Dropdown + Batch Dropdown */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Academic Class & Batch Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center space-x-1.5">
              <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Class:</label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedBatchId('ALL');
                }}
                className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">All Classes / Standards</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} ({cls.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <label className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Batch:</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700"
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} (Div {b.division})
                  </option>
                ))}
              </select>
            </div>

            {(selectedClassId !== 'ALL' || selectedBatchId !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClassId('ALL');
                  setSelectedBatchId('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Ledger or Batch Rollup View */}
      {viewMode === 'TABLE' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Invoice #</th>
                <th className="py-3.5 px-6">Student</th>
                <th className="py-3.5 px-6">Issue / Due Date</th>
                <th className="py-3.5 px-6 text-right">Total Amount</th>
                <th className="py-3.5 px-6 text-right">Paid</th>
                <th className="py-3.5 px-6 text-right">Balance Due</th>
                <th className="py-3.5 px-6 text-center">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No invoices match the current filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const stu = students[inv.student_id];
                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-slate-50/70 transition-all">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForDetail(inv.id)}
                          className="hover:text-emerald-700 hover:underline inline-flex items-center space-x-1.5 font-mono font-bold text-slate-900 group"
                          title="Click to View &amp; Print Dual-Copy Invoice"
                        >
                          <span>{inv.invoice_number}</span>
                          <Printer className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition" />
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        {inv.student_name || stu ? (
                          <div>
                            <p className="font-semibold text-slate-900">
                              {inv.student_name || `${stu?.first_name} ${stu?.last_name}`}
                            </p>
                            <p className="text-xs font-mono text-purple-700 font-semibold">
                              {inv.student_prn || stu?.prn || (inv.student_code ? inv.student_code.replace('STU-', 'PRN-') : (stu?.student_code ? stu.student_code.replace('STU-', 'PRN-') : '—'))}
                            </p>
                            {(inv.class_name || inv.batch_name) && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {inv.class_name && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                                    {inv.class_name}
                                  </span>
                                )}
                                {inv.batch_name && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                                    {inv.batch_name}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Loading student...</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600">
                        <div>Issue: {inv.issue_date}</div>
                        <div className="text-slate-400">Due: {inv.due_date}</div>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">
                        ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-emerald-600">
                        ₹{Number(inv.paid_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-amber-600">
                        ₹{Number(inv.balance_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : inv.status === 'OVERDUE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForDetail(inv.id)}
                            className="h-8 px-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all inline-flex items-center justify-center gap-1.5"
                            title="Print Dual-Copy (Student + Office) Invoice"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Print</span>
                          </button>

                          {inv.installments && inv.installments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                              className="h-8 px-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-all inline-flex items-center justify-center gap-1"
                            >
                              <span>{inv.installments.length} Inst</span>
                              {expandedInvoiceId === inv.id ? (
                                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                              )}
                            </button>
                          )}
                          {inv.balance_amount > 0 && (
                            <button
                              type="button"
                              onClick={() => openPaymentForInvoice(inv)}
                              className="h-8 px-3 border border-transparent bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all inline-flex items-center justify-center"
                            >
                              Collect Fee
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedInvoiceId === inv.id && inv.installments && inv.installments.length > 0 && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="py-3 px-8">
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between text-xs border-b pb-2">
                              <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Installment Breakdown &amp; Scheduled Due Dates</span>
                              </span>
                              <div className="flex items-center space-x-3">
                                <span className="text-[11px] text-slate-500">
                                  {inv.installments.filter((i) => i.status === 'PAID').length} of {inv.installments.length} Paid
                                </span>
                                {canRestructure && inv.balance_amount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openRestructureModal(inv)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer"
                                    title="Restructure remaining unpaid balance into new installments"
                                  >
                                    <Sliders className="w-3 h-3" />
                                    <span>Restructure Plan</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                              {[...(inv.installments || [])].sort((a, b) => a.installment_number - b.installment_number).map((inst) => (
                                <div
                                  key={inst.id}
                                  className={`p-2.5 rounded-lg border text-xs space-y-1.5 ${
                                    inst.status === 'PAID'
                                      ? 'bg-emerald-50/40 border-emerald-200'
                                      : inst.status === 'OVERDUE'
                                      ? 'bg-rose-50/40 border-rose-200'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-900">Inst #{inst.installment_number}</span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        inst.status === 'PAID'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : inst.status === 'OVERDUE'
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {inst.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] flex justify-between">
                                    <span className="text-slate-500">Amount:</span>
                                    <span className="font-semibold text-slate-800">₹{inst.amount.toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="text-[11px] flex justify-between">
                                    <span className="text-slate-500">Due Date:</span>
                                    <span className={`font-semibold ${inst.status === 'OVERDUE' ? 'text-rose-600' : 'text-slate-700'}`}>
                                      {inst.due_date}
                                    </span>
                                  </div>
                                  {canReschedule && inst.status !== 'PAID' && (
                                    <button
                                      type="button"
                                      onClick={() => openRescheduleModal(inv, inst)}
                                      className="w-full mt-1.5 py-1 px-2 text-[10px] font-semibold bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 text-slate-600 rounded-md shadow-2xs flex items-center justify-center space-x-1 transition"
                                    >
                                      <Calendar className="w-3 h-3" />
                                      <span>Reschedule Date</span>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Optimized Invoice Cards (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredInvoices.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">
              No invoices match the current filter.
            </p>
          ) : (
            filteredInvoices.map((inv) => {
              const stu = students[inv.student_id];
              return (
                <div key={inv.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForDetail(inv.id)}
                        className="font-mono font-bold text-xs text-slate-900 hover:text-emerald-700 hover:underline inline-flex items-center space-x-1"
                      >
                        <span>{inv.invoice_number}</span>
                        <Printer className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                      <h4 className="font-bold text-sm text-slate-900 mt-0.5">
                        {inv.student_name || (stu ? `${stu.first_name} ${stu.last_name}` : 'Student')}
                      </h4>
                      <p className="text-[11px] font-mono text-purple-700 font-semibold">
                        {inv.student_prn || stu?.prn || (inv.student_code ? inv.student_code.replace('STU-', 'PRN-') : (stu?.student_code ? stu.student_code.replace('STU-', 'PRN-') : '—'))}
                      </p>
                      {(inv.class_name || inv.batch_name) && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {inv.class_name && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                              {inv.class_name}
                            </span>
                          )}
                          {inv.batch_name && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                              {inv.batch_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : inv.status === 'OVERDUE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {inv.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Amounts breakdown */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500 font-medium">Total Billed</p>
                      <p className="font-bold text-slate-900 mt-0.5">₹{Number(inv.total_amount).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-700 font-medium">Paid</p>
                      <p className="font-bold text-emerald-600 mt-0.5">₹{Number(inv.paid_amount).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-700 font-medium">Balance</p>
                      <p className="font-bold text-amber-600 mt-0.5">₹{Number(inv.balance_amount).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Due: {inv.due_date}</span>
                    {inv.installments && inv.installments.length > 0 && (
                      <span className="font-semibold text-slate-700">{inv.installments.length} Installments</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceForDetail(inv.id)}
                      className="h-8 px-3 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition inline-flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Print Voucher</span>
                    </button>

                    <div className="inline-flex items-center gap-2">
                      {canRestructure && inv.balance_amount > 0 && (
                        <button
                          type="button"
                          onClick={() => openRestructureModal(inv)}
                          className="h-8 px-2.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold shadow-2xs transition inline-flex items-center justify-center gap-1.5"
                          title="Restructure Payment Plan"
                        >
                          <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Restructure</span>
                        </button>
                      )}
                      {inv.balance_amount > 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentForInvoice(inv)}
                          className="h-8 px-3 border border-transparent bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition inline-flex items-center justify-center"
                        >
                          Collect Fee
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      ) : (
        /* Batch Analytics & Rollup View */
        <div className="space-y-4">
          {batchRollupList.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">No Batches Matching Selection</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active student invoices were found for the selected academic filters. Try changing or clearing your Class and Batch filters.
              </p>
            </div>
          ) : (
            batchRollupList.map((b) => {
              const isExpanded = expandedBatchId === b.batchId;
              const rate = b.totalBilled > 0 ? Math.round((b.totalCollected / b.totalBilled) * 100) : 0;
              return (
                <div
                  key={b.batchId}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200"
                >
                  {/* Batch Card Header Summary */}
                  <div
                    onClick={() => setExpandedBatchId(isExpanded ? null : b.batchId)}
                    className="p-5 cursor-pointer hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                  >
                    <div className="flex items-start space-x-3.5">
                      <div className="p-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm md:text-base">{b.batchName}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            {b.className}
                          </span>
                          {b.courseName && b.courseName !== 'Academic Program' && (
                            <span className="text-[10px] font-medium text-slate-500">
                              ({b.courseName})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                          <span className="font-semibold text-slate-700">{b.invoices.length} Registered Invoices</span>
                          <span>•</span>
                          <span className={b.overdueCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                            {b.overdueCount > 0 ? `⚠️ ${b.overdueCount} Overdue Defaulter(s)` : '0 Overdue'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Progress & KPI Bar */}
                    <div className="flex items-center justify-between md:justify-end gap-5">
                      <div className="text-left md:text-right">
                        <div className="text-[11px] text-slate-400 font-medium">Collected / Billed</div>
                        <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                          <span className="text-emerald-600">₹{b.totalCollected.toLocaleString('en-IN')}</span>
                          <span className="text-slate-400"> / </span>
                          <span>₹{b.totalBilled.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-[11px] text-amber-600 font-bold mt-0.5">
                          Pending Due: ₹{b.totalBalanceDue.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="w-28 md:w-36">
                        <div className="flex justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-500">Recovery</span>
                          <span className={rate >= 75 ? 'text-emerald-600' : rate >= 40 ? 'text-blue-600' : 'text-amber-600'}>
                            {rate}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${
                              rate >= 75 ? 'bg-emerald-500' : rate >= 40 ? 'bg-blue-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, rate)}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition">
                        <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Student Invoices Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between pb-1">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>Student Invoice Ledger for {b.batchName} ({b.invoices.length} Students)</span>
                        </h4>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Click row or print icon for dual-copy legal receipt
                        </span>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                                <th className="py-2.5 px-4">Invoice #</th>
                                <th className="py-2.5 px-4">Student</th>
                                <th className="py-2.5 px-4">Due Date</th>
                                <th className="py-2.5 px-4 text-right">Total Fee</th>
                                <th className="py-2.5 px-4 text-right">Paid</th>
                                <th className="py-2.5 px-4 text-right">Balance</th>
                                <th className="py-2.5 px-4 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {b.invoices.map((inv) => {
                                const stu = students[inv.student_id];
                                return (
                                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedInvoiceForDetail(inv.id)}
                                        className="hover:text-emerald-700 hover:underline inline-flex items-center space-x-1"
                                      >
                                        <span>{inv.invoice_number}</span>
                                        <Printer className="w-3 h-3 text-slate-400" />
                                      </button>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-semibold text-slate-900">
                                        {inv.student_name || (stu ? `${stu.first_name} ${stu.last_name}` : 'Student')}
                                      </div>
                                      <div className="text-[10px] font-mono text-purple-700 font-bold">
                                        {inv.student_prn || stu?.prn || (inv.student_code ? inv.student_code.replace('STU-', 'PRN-') : (stu?.student_code ? stu.student_code.replace('STU-', 'PRN-') : '—'))}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600">
                                      {inv.due_date}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                                      ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                                      ₹{Number(inv.paid_amount).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-amber-600">
                                      ₹{Number(inv.balance_amount).toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          inv.status === 'PAID'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : inv.status === 'PARTIALLY_PAID'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : inv.status === 'OVERDUE'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {inv.status.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedInvoiceForDetail(inv.id)}
                                          className="h-7 px-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-medium shadow-2xs inline-flex items-center justify-center gap-1 transition-all"
                                          title="Print Dual-Copy Invoice"
                                        >
                                          <Printer className="w-3 h-3 text-slate-500 shrink-0" />
                                          <span>Print</span>
                                        </button>
                                        {inv.balance_amount > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => openPaymentForInvoice(inv)}
                                            className="h-7 px-2.5 border border-transparent bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs inline-flex items-center justify-center transition-all"
                                          >
                                            Collect Fee
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Fee Collection</h3>
                <p className="text-xs text-slate-500 font-mono">Invoice #{selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between text-xs">
              <div>
                <span className="text-slate-500">Student:</span>{' '}
                <span className="font-bold text-slate-900">
                  {selectedInvoice.student_name || (students[selectedInvoice.student_id] ? `${students[selectedInvoice.student_id]?.first_name} ${students[selectedInvoice.student_id]?.last_name}` : 'Student')}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Remaining Balance:</span>{' '}
                <span className="font-bold text-amber-600">₹{selectedInvoice.balance_amount}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Collection Amount (₹) *</label>
                <input
                  type="number"
                  required
                  max={selectedInvoice.balance_amount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full p-2.5 text-base font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="ONLINE_UPI">UPI / QR Code</option>
                    <option value="NET_BANKING">Net Banking / NEFT</option>
                    <option value="CREDIT_CARD">Credit / Debit Card</option>
                    <option value="CASH">Counter Cash</option>
                    <option value="CHEQUE">Bank Cheque / DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Transaction Ref / Cheque #</label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="e.g. UPI-998811"
                    className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Accountant Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional receipt notes..."
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || paymentAmount <= 0}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Allocating...' : 'Confirm Payment & Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Detailed Dual-Copy Invoice Modal */}
      {selectedInvoiceForDetail && (
        <InvoiceDetailModal
          isOpen={!!selectedInvoiceForDetail}
          invoiceId={selectedInvoiceForDetail}
          onClose={() => setSelectedInvoiceForDetail(null)}
          onCollectFee={(inv) => openPaymentForInvoice(inv)}
        />
      )}

      {/* Official Printable Receipt Modal */}
      {showReceiptModal && (
        <PaymentReceiptModal
          isOpen={showReceiptModal}
          paymentId={generatedReceipt?.id || null}
          initialReceiptData={generatedReceipt}
          onClose={() => {
            setShowReceiptModal(false);
            setGeneratedReceipt(null);
          }}
        />
      )}

      {/* Reschedule Installment Due Date Modal */}
      {rescheduleModalOpen && selectedInstallment && rescheduleParentInvoice && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reschedule Installment Due Date</h3>
                  <p className="text-xs text-slate-500 font-mono">Invoice #{rescheduleParentInvoice.invoice_number} • Inst #{selectedInstallment.installment_number}</p>
                </div>
              </div>
              <button onClick={() => setRescheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Student:</span>
                <span className="font-bold text-slate-900">
                  {students[rescheduleParentInvoice.student_id]?.first_name} {students[rescheduleParentInvoice.student_id]?.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Installment Amount:</span>
                <span className="font-bold text-slate-900">₹{selectedInstallment.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Due Date:</span>
                <span className="font-semibold text-rose-600">{selectedInstallment.due_date}</span>
              </div>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Due Date *</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reason for Rescheduling / Extension</label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Parent requested extension due to salary cycle"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling || !newDueDate}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
                >
                  {rescheduling ? 'Updating...' : 'Save New Due Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restructure Payment Plan Modal */}
      {restructureModalOpen && restructureParentInvoice && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Restructure Payment Plan</h3>
                  <p className="text-xs text-slate-500 font-mono">Invoice #{restructureParentInvoice.invoice_number}</p>
                </div>
              </div>
              <button onClick={() => setRestructureModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {restructureError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{restructureError}</span>
              </div>
            )}

            {/* Financial Ledger Summary Cards */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Total Billed</span>
                <strong className="text-slate-900 font-bold text-xs sm:text-sm">₹{Number(restructureParentInvoice.total_amount).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 block uppercase font-medium">Already Paid</span>
                <strong className="text-emerald-700 font-bold text-xs sm:text-sm">₹{Number(restructureParentInvoice.paid_amount).toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-[10px] text-indigo-700 block uppercase font-medium">Unpaid Balance</span>
                <strong className="text-indigo-700 font-bold text-xs sm:text-sm">₹{Number(restructureParentInvoice.balance_amount).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <form onSubmit={handleRestructureSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select New Installment Count for Remaining Balance *
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleRestructureCountChange(cnt)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition ${
                        restructureCount === cnt
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} {cnt === 1 ? 'Lump-sum' : 'EMIs'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Installment Items (Amounts & Due Dates) */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                <div className="grid grid-cols-3 gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider pb-1 border-b border-slate-200">
                  <span>Installment #</span>
                  <span>Amount (₹)</span>
                  <span>Due Date</span>
                </div>

                {restructureInstallments.map((inst, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 items-center text-xs">
                    <span className="font-bold text-slate-800 pl-1">
                      Inst #{inst.installment_number}
                    </span>
                    <input
                      type="number"
                      min="1"
                      required
                      value={inst.amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRestructureInstallments((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], amount: val };
                          return copy;
                        });
                      }}
                      className="text-xs p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input
                      type="date"
                      required
                      value={inst.due_date}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRestructureInstallments((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], due_date: val };
                          return copy;
                        });
                      }}
                      className="text-xs p-2 border border-slate-300 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                ))}

                {/* Real-time sum check */}
                {(() => {
                  const currentSum = restructureInstallments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                  const target = Number(restructureParentInvoice.balance_amount);
                  const diff = currentSum - target;
                  return (
                    <div className={`mt-2 pt-2 border-t text-[11px] font-semibold flex items-center justify-between ${
                      Math.abs(diff) < 0.05 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      <span>Sum: ₹{currentSum.toLocaleString('en-IN')} / Target: ₹{target.toLocaleString('en-IN')}</span>
                      <span>
                        {Math.abs(diff) < 0.05 ? '✓ Balanced' : diff > 0 ? `+₹${diff.toFixed(2)} Over` : `-₹${Math.abs(diff).toFixed(2)} Remaining`}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Restructuring (Mandatory Audit Trail) *
                </label>
                <input
                  type="text"
                  required
                  value={restructureReason}
                  onChange={(e) => setRestructureReason(e.target.value)}
                  placeholder="e.g. Parent requested extension and split into 3 EMIs due to crop cycle"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRestructureModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restructuring}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition"
                >
                  {restructuring ? 'Restructuring Plan...' : 'Save Restructured Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
