import React, { useState, useEffect } from 'react';
import {
  Users,
  Wallet,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Search,
  Building,
  CreditCard,
  FileText,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Landmark
} from 'lucide-react';
import apiClient from '../../api/client';
import { SalaryVoucherModal } from './SalaryVoucherModal';

interface ExpensesPayrollViewProps {
  selectedAcademicYearId: string;
  institute: any;
  grossStudentCollections: number;
}

interface StaffMember {
  id: string;
  name: string;
  role_designation: string;
  phone?: string | null;
  email?: string | null;
  base_monthly_salary: number;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  is_active: boolean;
  joining_date?: string | null;
}

interface MonthlyStaffPayrollItem {
  staff_id: string;
  staff_name: string;
  role_designation: string;
  phone?: string | null;
  base_monthly_salary: number;
  bank_account_no?: string | null;
  bank_ifsc?: string | null;
  upi_id?: string | null;
  is_active: boolean;
  is_paid: boolean;
  paid_amount?: number | null;
  payment_date?: string | null;
  payment_mode?: string | null;
  voucher_number?: string | null;
  reference_number?: string | null;
  expense_id?: string | null;
  notes?: string | null;
}

interface MonthlyPayrollSummary {
  pay_period_month: number;
  pay_period_year: number;
  total_staff_count: number;
  paid_staff_count: number;
  unpaid_staff_count: number;
  total_payroll_budget: number;
  total_payroll_disbursed: number;
  payroll_pending_balance: number;
  staff_roster: MonthlyStaffPayrollItem[];
}

interface ExpenseTransaction {
  id: string;
  institute_id: string;
  academic_year_id?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  staff_role?: string | null;
  expense_category: string;
  title: string;
  pay_period_month?: number | null;
  pay_period_year?: number | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number?: string | null;
  voucher_number: string;
  status: string;
  notes?: string | null;
  created_at: string;
}

interface ExpenseAnalyticsSummary {
  total_salaries_paid: number;
  total_other_expenses: number;
  total_expenses: number;
  gross_student_revenue: number;
  net_operating_balance: number;
  category_breakdown: Array<{ category: string; total_amount: number; count: number }>;
  monthly_trend: Array<{ year: number; month: number; total_amount: number; count: number }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EXPENSE_CATEGORIES = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'SALARY', label: 'Staff Salaries' },
  { value: 'RENT', label: 'Hostel & Facility Rent' },
  { value: 'UTILITIES', label: 'Electricity & Utilities' },
  { value: 'STATIONERY_PRINTING', label: 'Exams & Stationery' },
  { value: 'MAINTENANCE', label: 'Maintenance & Repairs' },
  { value: 'EQUIPMENT', label: 'Equipment & Tech' },
  { value: 'MARKETING', label: 'Marketing & Ads' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' }
];

export const ExpensesPayrollView: React.FC<ExpensesPayrollViewProps> = ({
  selectedAcademicYearId,
  institute,
  grossStudentCollections
}) => {
  const currentDate = new Date();
  const [selectedPayMonth, setSelectedPayMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedPayYear, setSelectedPayYear] = useState<number>(currentDate.getFullYear());

  const [activeSubTab, setActiveSubTab] = useState<'PAYROLL' | 'LEDGER'>('PAYROLL');
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [payrollData, setPayrollData] = useState<MonthlyPayrollSummary | null>(null);
  const [expenseLedger, setExpenseLedger] = useState<ExpenseTransaction[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseAnalyticsSummary | null>(null);

  // Filters
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [targetStaffForDisbursement, setTargetStaffForDisbursement] = useState<MonthlyStaffPayrollItem | null>(null);
  const [showRecordExpenseModal, setShowRecordExpenseModal] = useState<boolean>(false);

  // Voucher Slip Modal
  const [selectedVoucher, setSelectedVoucher] = useState<any | null>(null);
  const [showVoucherModal, setShowVoucherModal] = useState<boolean>(false);

  // Form states
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    role_designation: '',
    phone: '',
    email: '',
    base_monthly_salary: '',
    bank_name: '',
    bank_account_no: '',
    bank_ifsc: '',
    upi_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    is_active: true
  });

  const [disburseFormData, setDisburseFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    reference_number: '',
    notes: ''
  });

  const [generalExpenseFormData, setGeneralExpenseFormData] = useState({
    expense_category: 'RENT',
    title: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    reference_number: '',
    notes: ''
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load all expense data
  const loadExpenseData = async () => {
    try {
      setLoading(true);
      const ayParam = selectedAcademicYearId !== 'ALL' ? { academic_year_id: selectedAcademicYearId } : {};

      const [payrollRes, ledgerRes, summaryRes] = await Promise.all([
        apiClient.get<MonthlyPayrollSummary>('/expenses/payroll/monthly', {
          params: { month: selectedPayMonth, year: selectedPayYear }
        }),
        apiClient.get<ExpenseTransaction[]>('/expenses', {
          params: { ...ayParam, limit: 200 }
        }),
        apiClient.get<ExpenseAnalyticsSummary>('/expenses/summary', {
          params: ayParam
        })
      ]);

      setPayrollData(payrollRes.data);
      setExpenseLedger(ledgerRes.data);
      setExpenseSummary(summaryRes.data);
    } catch (err: any) {
      console.error('Failed to load expenses & payroll data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenseData();
  }, [selectedPayMonth, selectedPayYear, selectedAcademicYearId]);

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedPayMonth === 1) {
      setSelectedPayMonth(12);
      setSelectedPayYear((prev) => prev - 1);
    } else {
      setSelectedPayMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedPayMonth === 12) {
      setSelectedPayMonth(1);
      setSelectedPayYear((prev) => prev + 1);
    } else {
      setSelectedPayMonth((prev) => prev + 1);
    }
  };

  // Open Disburse Modal for a staff member
  const handleOpenDisburseModal = (staff: MonthlyStaffPayrollItem) => {
    setTargetStaffForDisbursement(staff);
    setDisburseFormData({
      amount: String(staff.base_monthly_salary || ''),
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: staff.bank_account_no ? 'BANK_TRANSFER' : (staff.upi_id ? 'UPI' : 'CASH'),
      reference_number: '',
      notes: `Monthly Salary for ${MONTH_NAMES[selectedPayMonth - 1]} ${selectedPayYear}`
    });
    setErrorMessage(null);
    setShowDisburseModal(true);
  };

  // Submit Salary Disbursement
  const handleSubmitDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStaffForDisbursement) return;

    const amt = parseFloat(disburseFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMessage('Please enter a valid disbursement amount greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await apiClient.post<ExpenseTransaction>('/expenses/payroll/disburse', {
        staff_id: targetStaffForDisbursement.staff_id,
        pay_period_month: selectedPayMonth,
        pay_period_year: selectedPayYear,
        amount: amt,
        payment_date: disburseFormData.payment_date,
        payment_mode: disburseFormData.payment_mode,
        reference_number: disburseFormData.reference_number || undefined,
        notes: disburseFormData.notes || undefined,
        academic_year_id: selectedAcademicYearId !== 'ALL' ? selectedAcademicYearId : undefined
      });

      setShowDisburseModal(false);
      await loadExpenseData();

      // Open print voucher modal for convenience
      setSelectedVoucher({
        voucher_number: res.data.voucher_number,
        title: res.data.title,
        category: 'SALARY',
        amount: res.data.amount,
        payment_date: res.data.payment_date,
        payment_mode: res.data.payment_mode,
        reference_number: res.data.reference_number,
        staff_name: targetStaffForDisbursement.staff_name,
        staff_role: targetStaffForDisbursement.role_designation,
        pay_period_month: selectedPayMonth,
        pay_period_year: selectedPayYear,
        notes: res.data.notes
      });
      setShowVoucherModal(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to disburse salary.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Add/Edit Staff Modal
  const handleOpenStaffModal = (staff?: StaffMember) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffFormData({
        name: staff.name,
        role_designation: staff.role_designation,
        phone: staff.phone || '',
        email: staff.email || '',
        base_monthly_salary: String(staff.base_monthly_salary || '0'),
        bank_name: staff.bank_name || '',
        bank_account_no: staff.bank_account_no || '',
        bank_ifsc: staff.bank_ifsc || '',
        upi_id: staff.upi_id || '',
        joining_date: staff.joining_date || new Date().toISOString().split('T')[0],
        is_active: staff.is_active
      });
    } else {
      setEditingStaff(null);
      setStaffFormData({
        name: '',
        role_designation: '',
        phone: '',
        email: '',
        base_monthly_salary: '',
        bank_name: '',
        bank_account_no: '',
        bank_ifsc: '',
        upi_id: '',
        joining_date: new Date().toISOString().split('T')[0],
        is_active: true
      });
    }
    setErrorMessage(null);
    setShowAddStaffModal(true);
  };

  // Submit Staff Creation / Update
  const handleSubmitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFormData.name.trim()) {
      setErrorMessage('Staff member full name is required.');
      return;
    }
    if (!staffFormData.role_designation.trim()) {
      setErrorMessage('Staff role or designation is required.');
      return;
    }
    const sal = parseFloat(staffFormData.base_monthly_salary || '0');
    if (isNaN(sal) || sal < 0) {
      setErrorMessage('Please enter a valid base monthly salary.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const payload = {
        name: staffFormData.name.trim(),
        role_designation: staffFormData.role_designation.trim(),
        phone: staffFormData.phone.trim() || undefined,
        email: staffFormData.email.trim() || undefined,
        base_monthly_salary: sal,
        bank_name: staffFormData.bank_name.trim() || undefined,
        bank_account_no: staffFormData.bank_account_no.trim() || undefined,
        bank_ifsc: staffFormData.bank_ifsc.trim() || undefined,
        upi_id: staffFormData.upi_id.trim() || undefined,
        joining_date: staffFormData.joining_date || undefined,
        is_active: staffFormData.is_active
      };

      if (editingStaff) {
        await apiClient.put(`/expenses/staff/${editingStaff.id}`, payload);
      } else {
        await apiClient.post('/expenses/staff', payload);
      }

      setShowAddStaffModal(false);
      await loadExpenseData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to save staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit General Operational Expense
  const handleSubmitGeneralExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generalExpenseFormData.title.trim()) {
      setErrorMessage('Please enter an expense title / description.');
      return;
    }
    const amt = parseFloat(generalExpenseFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await apiClient.post<ExpenseTransaction>('/expenses', {
        expense_category: generalExpenseFormData.expense_category,
        title: generalExpenseFormData.title.trim(),
        amount: amt,
        payment_date: generalExpenseFormData.payment_date,
        payment_mode: generalExpenseFormData.payment_mode,
        reference_number: generalExpenseFormData.reference_number.trim() || undefined,
        notes: generalExpenseFormData.notes.trim() || undefined,
        academic_year_id: selectedAcademicYearId !== 'ALL' ? selectedAcademicYearId : undefined
      });

      setShowRecordExpenseModal(false);
      setGeneralExpenseFormData({
        expense_category: 'RENT',
        title: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'BANK_TRANSFER',
        reference_number: '',
        notes: ''
      });
      await loadExpenseData();

      // View Voucher Slip
      setSelectedVoucher({
        voucher_number: res.data.voucher_number,
        title: res.data.title,
        category: res.data.expense_category,
        amount: res.data.amount,
        payment_date: res.data.payment_date,
        payment_mode: res.data.payment_mode,
        reference_number: res.data.reference_number,
        notes: res.data.notes
      });
      setShowVoucherModal(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense Transaction
  const handleDeleteExpense = async (exp: ExpenseTransaction) => {
    if (!window.confirm(`Are you sure you want to delete expense voucher ${exp.voucher_number} (₹${exp.amount})?`)) {
      return;
    }
    try {
      await apiClient.delete(`/expenses/${exp.id}`);
      await loadExpenseData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete expense voucher.');
    }
  };

  // Filtered expense ledger items
  const filteredLedger = expenseLedger.filter((item) => {
    if (selectedCategoryFilter !== 'ALL' && item.expense_category !== selectedCategoryFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.voucher_number.toLowerCase().includes(q) ||
        (item.staff_name && item.staff_name.toLowerCase().includes(q)) ||
        (item.reference_number && item.reference_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPayrollPaid = expenseSummary?.total_salaries_paid || 0;
  const totalOtherExpenses = expenseSummary?.total_other_expenses || 0;
  const totalInstituteExpenses = expenseSummary?.total_expenses || 0;
  const netOperatingBalance = grossStudentCollections - totalInstituteExpenses;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-200">
      {/* Top 4 KPI Financial Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Total Payroll Paid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff Payroll</span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹{totalPayrollPaid.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Faculty, Wardens, Admin &amp; Support staff salaries
            </p>
          </div>
        </div>

        {/* Other Operational Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Other Operational Outflow</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹{totalOtherExpenses.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Hostel/facility lease, utilities, printing &amp; maintenance
            </p>
          </div>
        </div>

        {/* Total Institute Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Gross Expenditures</span>
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              ₹{totalInstituteExpenses.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Combined payroll &amp; operational running costs
            </p>
          </div>
        </div>

        {/* Net Operating Surplus / Balance */}
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden ${
          netOperatingBalance >= 0 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              netOperatingBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              Net Operating Balance
            </span>
            <div className={`p-2 rounded-xl ${
              netOperatingBalance >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {netOperatingBalance >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="mt-3">
            <p className={`text-2xl font-black font-mono tracking-tight ${
              netOperatingBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'
            }`}>
              ₹{netOperatingBalance.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              ₹{grossStudentCollections.toLocaleString('en-IN')} Collections − ₹{totalInstituteExpenses.toLocaleString('en-IN')} Expenses
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Navigation & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Toggle between Monthly Payroll and Expense Ledger */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('PAYROLL')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'PAYROLL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-purple-600" />
            <span>Monthly Staff Payroll</span>
            {payrollData && (
              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 text-[10px] rounded-full font-bold">
                {payrollData.total_staff_count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('LEDGER')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'LEDGER'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Expenditure Ledger</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[10px] rounded-full font-bold">
              {expenseLedger.length}
            </span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => handleOpenStaffModal()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setShowRecordExpenseModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: MONTHLY STAFF PAYROLL MATRIX */}
      {activeSubTab === 'PAYROLL' && (
        <div className="space-y-4">
          {/* Month & Year Navigation Strip */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center sm:text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Payroll Cycle
                </span>
                <span className="text-base sm:text-lg font-black text-slate-900">
                  {MONTH_NAMES[selectedPayMonth - 1]} {selectedPayYear}
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Monthly Progress Stats */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
              <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Monthly Budget</span>
                <span className="text-sm font-black font-mono text-slate-900">
                  ₹{(payrollData?.total_payroll_budget || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-emerald-700 block text-[10px] uppercase font-bold">Disbursed ({payrollData?.paid_staff_count || 0})</span>
                <span className="text-sm font-black font-mono text-emerald-800">
                  ₹{(payrollData?.total_payroll_disbursed || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-amber-700 block text-[10px] uppercase font-bold">Pending ({payrollData?.unpaid_staff_count || 0})</span>
                <span className="text-sm font-black font-mono text-amber-800">
                  ₹{(payrollData?.payroll_pending_balance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Staff Roster Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member &amp; Role</th>
                    <th className="py-3.5 px-3">Contact</th>
                    <th className="py-3.5 px-3 text-right">Base Salary</th>
                    <th className="py-3.5 px-3">Bank / UPI Details</th>
                    <th className="py-3.5 px-3 text-center">{MONTH_NAMES[selectedPayMonth - 1]} Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!payrollData || payrollData.staff_roster.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">No staff members registered yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Click &quot;Add Staff Member&quot; to register teachers, wardens, or support staff.</p>
                      </td>
                    </tr>
                  ) : (
                    payrollData.staff_roster.map((staff) => (
                      <tr key={staff.staff_id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-xs">
                              {staff.staff_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{staff.staff_name}</p>
                              <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold mt-0.5">
                                {staff.role_designation}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-slate-600">
                          {staff.phone || <span className="text-slate-400 italic">No phone</span>}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 text-sm">
                          ₹{staff.base_monthly_salary.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3.5 px-3 text-slate-600 font-mono text-[11px]">
                          {staff.bank_account_no ? (
                            <div>
                              <span className="font-semibold text-slate-800">A/C: {staff.bank_account_no}</span>
                              {staff.bank_ifsc && <span className="block text-slate-400 text-[10px]">{staff.bank_ifsc}</span>}
                            </div>
                          ) : staff.upi_id ? (
                            <span className="text-blue-700 font-semibold">{staff.upi_id}</span>
                          ) : (
                            <span className="text-slate-400 italic font-sans text-xs">Cash disbursement</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          {staff.is_paid ? (
                            <div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                <span>Paid ₹{(staff.paid_amount || 0).toLocaleString('en-IN')}</span>
                              </span>
                              <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                                {staff.voucher_number} • {staff.payment_date}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 mr-1 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {staff.is_paid ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVoucher({
                                    voucher_number: staff.voucher_number || '',
                                    title: `Salary - ${MONTH_NAMES[selectedPayMonth - 1]} ${selectedPayYear} - ${staff.staff_name}`,
                                    category: 'SALARY',
                                    amount: staff.paid_amount || staff.base_monthly_salary,
                                    payment_date: staff.payment_date || '',
                                    payment_mode: staff.payment_mode || 'BANK_TRANSFER',
                                    reference_number: staff.reference_number,
                                    staff_name: staff.staff_name,
                                    staff_role: staff.role_designation,
                                    pay_period_month: selectedPayMonth,
                                    pay_period_year: selectedPayYear,
                                    notes: staff.notes
                                  });
                                  setShowVoucherModal(true);
                                }}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                                title="View / Print Salary Voucher"
                              >
                                <Printer className="w-3 h-3 text-slate-500" />
                                <span>Slip</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenDisburseModal(staff)}
                                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>Pay Salary</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenStaffModal({
                                id: staff.staff_id,
                                name: staff.staff_name,
                                role_designation: staff.role_designation,
                                phone: staff.phone,
                                base_monthly_salary: staff.base_monthly_salary,
                                bank_account_no: staff.bank_account_no,
                                bank_ifsc: staff.bank_ifsc,
                                upi_id: staff.upi_id,
                                is_active: staff.is_active
                              })}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                              title="Edit Staff Compensation / Coordinates"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: EXPENDITURE LEDGER */}
      {activeSubTab === 'LEDGER' && (
        <div className="space-y-4">
          {/* Category Filter and Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search voucher #, title, ref..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 font-medium"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 font-semibold self-end md:self-auto">
              Showing {filteredLedger.length} of {expenseLedger.length} transactions
            </span>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Date &amp; Voucher</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-4">Title / Description</th>
                    <th className="py-3.5 px-3">Payment Mode &amp; Ref</th>
                    <th className="py-3.5 px-4 text-right">Amount (₹)</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-sm text-slate-600">No expense records found.</p>
                        <p className="text-xs text-slate-400 mt-1">Record a rent, utility bill, or salary payment to populate this ledger.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block font-mono text-xs">{exp.voucher_number}</span>
                          <span className="text-[11px] text-slate-500">{exp.payment_date}</span>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            exp.expense_category === 'SALARY'
                              ? 'bg-purple-100 text-purple-800'
                              : exp.expense_category === 'RENT'
                              ? 'bg-amber-100 text-amber-800'
                              : exp.expense_category === 'UTILITIES'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {exp.expense_category}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {exp.title}
                          {exp.staff_name && (
                            <span className="block text-[11px] text-slate-500 font-normal">
                              Staff: {exp.staff_name} ({exp.staff_role})
                            </span>
                          )}
                          {exp.notes && (
                            <span className="block text-[10px] text-slate-400 italic">{exp.notes}</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {exp.payment_mode.replace('_', ' ')}
                          </span>
                          {exp.reference_number && (
                            <span className="font-mono text-[10px] text-slate-400">
                              Ref: {exp.reference_number}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          ₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVoucher({
                                  voucher_number: exp.voucher_number,
                                  title: exp.title,
                                  category: exp.expense_category,
                                  amount: exp.amount,
                                  payment_date: exp.payment_date,
                                  payment_mode: exp.payment_mode,
                                  reference_number: exp.reference_number,
                                  staff_name: exp.staff_name,
                                  staff_role: exp.staff_role,
                                  pay_period_month: exp.pay_period_month,
                                  pay_period_year: exp.pay_period_year,
                                  notes: exp.notes
                                });
                                setShowVoucherModal(true);
                              }}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded-lg transition cursor-pointer"
                              title="Print Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Delete Voucher"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-300" />
                <h3 className="font-bold text-sm tracking-wide">
                  {editingStaff ? 'Edit Staff Compensation' : 'Add Institute Staff / Faculty'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="p-1 hover:bg-purple-800 rounded-lg transition text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitStaff} className="p-6 space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Staff Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffFormData.name}
                    onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                    placeholder="e.g. Ramesh Patil"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Designation / Role <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffFormData.role_designation}
                    onChange={(e) => setStaffFormData({ ...staffFormData, role_designation: e.target.value })}
                    placeholder="e.g. Physics Faculty / Warden / Peon"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Base Monthly Salary (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={staffFormData.base_monthly_salary}
                    onChange={(e) => setStaffFormData({ ...staffFormData, base_monthly_salary: e.target.value })}
                    placeholder="e.g. 35000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone</label>
                  <input
                    type="tel"
                    value={staffFormData.phone}
                    onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={staffFormData.email}
                    onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                    placeholder="staff@yashodeep.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bank & Settlement Coordinates */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block">
                  Disbursement Coordinates (For Direct NEFT / UPI)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      value={staffFormData.bank_name}
                      onChange={(e) => setStaffFormData({ ...staffFormData, bank_name: e.target.value })}
                      placeholder="e.g. SBI / HDFC"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Account Number</label>
                    <input
                      type="text"
                      value={staffFormData.bank_account_no}
                      onChange={(e) => setStaffFormData({ ...staffFormData, bank_account_no: e.target.value })}
                      placeholder="e.g. 123456789012"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">IFSC Code</label>
                    <input
                      type="text"
                      value={staffFormData.bank_ifsc}
                      onChange={(e) => setStaffFormData({ ...staffFormData, bank_ifsc: e.target.value.toUpperCase() })}
                      placeholder="e.g. SBIN0001234"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono uppercase focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">UPI ID (Optional)</label>
                    <input
                      type="text"
                      value={staffFormData.upi_id}
                      onChange={(e) => setStaffFormData({ ...staffFormData, upi_id: e.target.value })}
                      placeholder="e.g. staff@okhdfcbank"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (editingStaff ? 'Update Staff' : 'Save Staff Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISBURSE SALARY */}
      {showDisburseModal && targetStaffForDisbursement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-sm tracking-wide">
                  Disburse Monthly Salary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDisburseModal(false)}
                className="p-1 hover:bg-emerald-700 rounded-lg transition text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitDisbursement} className="p-6 space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Staff Overview Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="font-bold text-slate-900 text-sm">
                  {targetStaffForDisbursement.staff_name}
                </p>
                <p className="text-xs text-slate-600 font-medium">
                  {targetStaffForDisbursement.role_designation}
                </p>
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Salary Period:</span>
                  <span className="font-bold text-slate-900">
                    {MONTH_NAMES[selectedPayMonth - 1]} {selectedPayYear}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-500 font-semibold">Standard Base:</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{targetStaffForDisbursement.base_monthly_salary.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Disbursement Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={disburseFormData.amount}
                  onChange={(e) => setDisburseFormData({ ...disburseFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={disburseFormData.payment_mode}
                    onChange={(e) => setDisburseFormData({ ...disburseFormData, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={disburseFormData.payment_date}
                    onChange={(e) => setDisburseFormData({ ...disburseFormData, payment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction UTR / Reference No. (Optional)
                </label>
                <input
                  type="text"
                  value={disburseFormData.reference_number}
                  onChange={(e) => setDisburseFormData({ ...disburseFormData, reference_number: e.target.value })}
                  placeholder="e.g. UTR198273641 / Cheque #88192"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={disburseFormData.notes}
                  onChange={(e) => setDisburseFormData({ ...disburseFormData, notes: e.target.value })}
                  placeholder="e.g. Full settlement with festive bonus"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDisburseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Disbursing...' : 'Confirm & Generate Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD GENERAL OPERATIONAL EXPENSE */}
      {showRecordExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm tracking-wide">
                  Record Institute Operational Expense
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordExpenseModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-300 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitGeneralExpense} className="p-6 space-y-4 text-xs">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Expense Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={generalExpenseFormData.expense_category}
                  onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, expense_category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="RENT">Hostel / Facility Rent &amp; Lease</option>
                  <option value="UTILITIES">Electricity, Water &amp; Internet Utilities</option>
                  <option value="STATIONERY_PRINTING">Exam Papers, Books &amp; Stationery</option>
                  <option value="MAINTENANCE">Campus Maintenance &amp; Cleaning</option>
                  <option value="EQUIPMENT">Lab Equipment, Projectors &amp; Furniture</option>
                  <option value="MARKETING">Advertisements &amp; Banners</option>
                  <option value="MISCELLANEOUS">Miscellaneous / Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Expense Title / Payee <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={generalExpenseFormData.title}
                  onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, title: e.target.value })}
                  placeholder="e.g. Study Room Electricity Bill - Oct"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={generalExpenseFormData.amount}
                  onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, amount: e.target.value })}
                  placeholder="e.g. 15000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={generalExpenseFormData.payment_mode}
                    onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, payment_mode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={generalExpenseFormData.payment_date}
                    onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, payment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bill # / Reference / UTR (Optional)
                </label>
                <input
                  type="text"
                  value={generalExpenseFormData.reference_number}
                  onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, reference_number: e.target.value })}
                  placeholder="e.g. MSEB-BILL-991823"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Additional Notes</label>
                <textarea
                  rows={2}
                  value={generalExpenseFormData.notes}
                  onChange={(e) => setGeneralExpenseFormData({ ...generalExpenseFormData, notes: e.target.value })}
                  placeholder="e.g. Paid via official institute bank account"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRecordExpenseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Expense & Print Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINTABLE SALARY SLIP / EXPENSE VOUCHER */}
      {showVoucherModal && selectedVoucher && (
        <SalaryVoucherModal
          isOpen={showVoucherModal}
          onClose={() => setShowVoucherModal(false)}
          voucherData={selectedVoucher}
          institute={institute}
        />
      )}
    </div>
  );
};
