import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Calendar,
  Users,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Receipt,
  Sparkles,
  ShieldAlert,
  DollarSign,
  Send,
  MessageSquare,
  Mail,
  Building,
  Home,
  Armchair,
  Check,
  X,
  RotateCcw,
  Loader2,
  ChevronRight,
  Filter,
  Layers,
  ArrowRightLeft,
  UserMinus,
  CheckSquare,
  HelpCircle,
  Clock,
  Plus
} from 'lucide-react';
import apiClient from '../api/client';

interface CohortStudentItem {
  student_id: string;
  enrollment_id: string;
  student_name: string;
  student_code: string;
  prn?: string;
  roll_number?: number | null;
  gender: string;
  enrollment_status: string;
  promotion_status: string;
  attendance_rate: number;
  total_invoiced: number | string;
  total_paid: number | string;
  balance_due: number | string;
  has_hostel_bed: boolean;
  hostel_bed_code?: string | null;
  has_study_desk: boolean;
  study_desk_code?: string | null;
}

interface CohortReviewData {
  batch_id: string;
  batch_name: string;
  batch_code: string;
  division: string;
  class_id: string;
  class_name: string;
  academic_year_id: string;
  academic_year_name: string;
  total_enrolled: number;
  students: CohortStudentItem[];
}

interface StudentPromotionDecision {
  student_id: string;
  enrollment_id: string;
  action: 'PROMOTE' | 'GRADUATE' | 'WITHDRAW';
  custom_concession: number;
  override_batch_id?: string;
}

interface BulkPromotionResponse {
  promoted_count: number;
  graduated_count: number;
  withdrawn_count: number;
  total_invoiced_amount: number | string;
  new_invoices: Array<{
    student_name: string;
    prn: string;
    invoice_number: string;
    total_amount: number;
  }>;
  messages: string[];
}

interface CohortPromotionWizardProps {
  academicYears: any[];
  classes: any[];
  courses: any[];
  batches: any[];
  onRefreshAcademics?: () => void;
}

export const CohortPromotionWizard: React.FC<CohortPromotionWizardProps> = ({
  academicYears,
  classes,
  courses,
  batches,
  onRefreshAcademics
}) => {
  // Navigation step: 1 = Cohort Select, 2 = Student Decisions, 3 = Target & Fee Config, 4 = Review & Execute
  const [step, setStep] = useState<number>(1);

  // Selection state
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState<string>('');
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [sourceBatchId, setSourceBatchId] = useState<string>('');

  // Roster Review state
  const [loadingCohort, setLoadingCohort] = useState<boolean>(false);
  const [cohortData, setCohortData] = useState<CohortReviewData | null>(null);
  const [decisions, setDecisions] = useState<Record<string, StudentPromotionDecision>>({});
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PROMOTE' | 'GRADUATE' | 'WITHDRAW' | 'ARREARS'>('ALL');

  // Target Year & Invoicing Config
  const [targetAcademicYearId, setTargetAcademicYearId] = useState<string>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [targetCourseId, setTargetCourseId] = useState<string>('');
  const [targetTuitionFee, setTargetTuitionFee] = useState<number>(0);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [priorDuesAction, setPriorDuesAction] = useState<'CARRY_FORWARD' | 'BLOCK_IF_DUE'>('CARRY_FORWARD');
  const [notifyParents, setNotifyParents] = useState<boolean>(true);

  // Quick New Academic Year Creation Modal
  const [showAddAyModal, setShowAddAyModal] = useState<boolean>(false);
  const [newAyName, setNewAyName] = useState<string>('2027-2028');
  const [newAyCode, setNewAyCode] = useState<string>('AY-2027-28');
  const [newAyStartDate, setNewAyStartDate] = useState<string>('2027-06-01');
  const [newAyEndDate, setNewAyEndDate] = useState<string>('2028-05-31');
  const [creatingAy, setCreatingAy] = useState<boolean>(false);

  // Execution State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [promotionResult, setPromotionResult] = useState<BulkPromotionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default source academic year (current year)
  useEffect(() => {
    if (academicYears.length > 0 && !sourceAcademicYearId) {
      const curAy = academicYears.find((y) => y.is_current) || academicYears[0];
      setSourceAcademicYearId(curAy.id);
    }
  }, [academicYears, sourceAcademicYearId]);

  // Set default target academic year (first non-current year or upcoming year)
  useEffect(() => {
    if (academicYears.length > 0 && !targetAcademicYearId) {
      const nextAy = academicYears.find((y) => !y.is_current) || academicYears[0];
      if (nextAy) setTargetAcademicYearId(nextAy.id);
    }
  }, [academicYears, targetAcademicYearId]);

  // Auto-fill target tuition fee when targetCourse changes
  useEffect(() => {
    if (targetCourseId) {
      const selCourse = courses.find((c) => c.id === targetCourseId);
      if (selCourse && selCourse.current_version) {
        setTargetTuitionFee(Number(selCourse.current_version.base_fee || 0));
      }
    }
  }, [targetCourseId, courses]);

  // Filter batches for source selection
  const availableSourceBatches = batches.filter((b) => {
    const matchesYear = !sourceAcademicYearId || b.academic_year_id === sourceAcademicYearId;
    const matchesClass = !sourceClassId || b.class_id === sourceClassId || (b.course_name && sourceClassId && b.course_id);
    return matchesYear && matchesClass;
  });

  // Handle Load Cohort Review
  const handleLoadCohort = async () => {
    if (!sourceBatchId) return;
    setLoadingCohort(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.get<CohortReviewData>(`/enrollments/cohort/${sourceBatchId}/review`);
      setCohortData(res.data);

      // Pre-populate decisions (default PROMOTE for all)
      const initialDecisions: Record<string, StudentPromotionDecision> = {};
      res.data.students.forEach((stu) => {
        initialDecisions[stu.student_id] = {
          student_id: stu.student_id,
          enrollment_id: stu.enrollment_id,
          action: 'PROMOTE',
          custom_concession: 0
        };
      });
      setDecisions(initialDecisions);

      // Auto-suggest next class (e.g. 9th -> 10th)
      const curClass = classes.find((c) => c.id === res.data.class_id);
      if (curClass) {
        const nextOrder = (curClass.order_index || 0) + 1;
        const nextClass = classes.find((c) => c.order_index === nextOrder);
        if (nextClass) {
          setTargetClassId(nextClass.id);
          // Auto-select course for that class
          const matchingCourse = courses.find((c) => c.class_id === nextClass.id);
          if (matchingCourse) {
            setTargetCourseId(matchingCourse.id);
          }
        }
      }

      setStep(2);
    } catch (err: any) {
      console.error('Failed to load cohort review:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to load cohort roster for rollover.');
    } finally {
      setLoadingCohort(false);
    }
  };

  // Quick Action Setters
  const setAllActions = (action: 'PROMOTE' | 'GRADUATE' | 'WITHDRAW') => {
    if (!cohortData) return;
    setDecisions((prev) => {
      const next = { ...prev };
      cohortData.students.forEach((stu) => {
        next[stu.student_id] = {
          ...next[stu.student_id],
          action
        };
      });
      return next;
    });
  };

  const handleCreateAcademicYear = async () => {
    setCreatingAy(true);
    setErrorMessage(null);
    try {
      await apiClient.post('/academics/years', {
        name: newAyName,
        code: newAyCode,
        start_date: newAyStartDate,
        end_date: newAyEndDate,
        is_current: false
      });
      setShowAddAyModal(false);
      if (onRefreshAcademics) {
        onRefreshAcademics();
      }
    } catch (err: any) {
      console.error('Failed to create academic year:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to create academic year');
    } finally {
      setCreatingAy(false);
    }
  };

  // Execution Submit
  const handleExecutePromotion = async () => {
    if (!cohortData || !targetAcademicYearId) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        source_academic_year_id: sourceAcademicYearId,
        source_batch_id: sourceBatchId,
        target_academic_year_id: targetAcademicYearId,
        target_class_id: targetClassId || undefined,
        target_course_id: targetCourseId || undefined,
        target_tuition_fee: targetTuitionFee > 0 ? targetTuitionFee : undefined,
        number_of_installments: installmentCount,
        prior_dues_action: priorDuesAction,
        notify_parents: notifyParents,
        students: Object.values(decisions)
      };

      const res = await apiClient.post<BulkPromotionResponse>('/enrollments/bulk-promote', payload);
      setPromotionResult(res.data);
      setStep(4);
      if (onRefreshAcademics) {
        onRefreshAcademics();
      }
    } catch (err: any) {
      console.error('Promotion execution failed:', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to complete cohort rollover.');
    } finally {
      setSubmitting(false);
    }
  };

  // Derived counts for Step 2
  const studentList = cohortData?.students || [];
  const promoteCount = Object.values(decisions).filter((d) => d.action === 'PROMOTE').length;
  const graduateCount = Object.values(decisions).filter((d) => d.action === 'GRADUATE').length;
  const withdrawCount = Object.values(decisions).filter((d) => d.action === 'WITHDRAW').length;
  const totalArrearsAmount = studentList.reduce((sum, s) => sum + Number(s.balance_due || 0), 0);
  const studentsWithArrears = studentList.filter((s) => Number(s.balance_due || 0) > 0);

  // Filtered students for display
  const filteredStudents = studentList.filter((s) => {
    const matchesSearch =
      !searchFilter ||
      s.student_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.prn && s.prn.toLowerCase().includes(searchFilter.toLowerCase())) ||
      s.student_code.toLowerCase().includes(searchFilter.toLowerCase());

    const dec = decisions[s.student_id];
    if (statusFilter === 'PROMOTE') return matchesSearch && dec?.action === 'PROMOTE';
    if (statusFilter === 'GRADUATE') return matchesSearch && dec?.action === 'GRADUATE';
    if (statusFilter === 'WITHDRAW') return matchesSearch && dec?.action === 'WITHDRAW';
    if (statusFilter === 'ARREARS') return matchesSearch && Number(s.balance_due || 0) > 0;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> End-of-Session Engine
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Atomic Rollover & Invoicing
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-blue-400" />
              Academic Year Rollover & Cohort Promotion
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Seamlessly promote student batches into the next academic year (e.g. 2026–2027 to 2027–2028),
              generate next-year tuition fee vouchers with flexible installments, handle prior arrears, and notify parents.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddAyModal(true)}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border border-white/10 backdrop-blur-sm"
            >
              <Plus className="w-4 h-4 text-blue-300" />
              <span>Create Next AY</span>
            </button>
          </div>
        </div>

        {/* Wizard Steps Nav */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-6 pt-5 border-t border-white/10">
          {[
            { num: 1, label: 'Select Cohort', desc: 'Choose Batch & Year' },
            { num: 2, label: 'Roster Decisions', desc: 'Promote / Graduate' },
            { num: 3, label: 'Target & Invoicing', desc: 'Fees, Plans & Arrears' },
            { num: 4, label: 'Rollout Summary', desc: 'Review & Dispatches' }
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
              className={`p-3 rounded-xl transition-all ${
                step === s.num
                  ? 'bg-blue-600/40 border border-blue-400/50 shadow-inner'
                  : step > s.num
                  ? 'bg-emerald-950/40 border border-emerald-500/30 cursor-pointer hover:bg-emerald-900/40'
                  : 'bg-white/5 border border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s.num
                      ? 'bg-blue-500 text-white'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                </span>
                <span className="text-xs font-bold truncate text-white">{s.label}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 pl-8 hidden sm:block truncate">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Action Required</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: SELECT COHORT */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Step 1: Select Source Academic Session & Cohort Batch</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select the active academic session, class standard, and teaching batch that is finishing to review its roster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Source Academic Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Source Academic Session *</span>
              </label>
              <select
                value={sourceAcademicYearId}
                onChange={(e) => setSourceAcademicYearId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.name} ({ay.code}) {ay.is_current ? '• [CURRENT]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Class */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Filter by Class / Standard</span>
              </label>
              <select
                value={sourceClassId}
                onChange={(e) => {
                  setSourceClassId(e.target.value);
                  setSourceBatchId('');
                }}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Standards</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Batch */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Cohort Batch to Promote *</span>
              </label>
              <select
                value={sourceBatchId}
                onChange={(e) => setSourceBatchId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose Finishing Batch --</option>
                {availableSourceBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) • Div {b.division || 'A'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleLoadCohort}
              disabled={!sourceBatchId || loadingCohort}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center space-x-2 transition-all ${
                !sourceBatchId || loadingCohort
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg cursor-pointer'
              }`}
            >
              {loadingCohort ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Cohort Roster...</span>
                </>
              ) : (
                <>
                  <span>Load Cohort Roster</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ROSTER DECISIONS */}
      {step === 2 && cohortData && (
        <div className="space-y-5">
          {/* Cohort Info Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Active Cohort Selected</span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {cohortData.batch_name} ({cohortData.batch_code})
                </h3>
                <p className="text-xs text-slate-500">
                  Standard: <span className="font-semibold text-slate-700">{cohortData.class_name}</span> • Session:{' '}
                  <span className="font-semibold text-slate-700">{cohortData.academic_year_name}</span> • Division:{' '}
                  <span className="font-semibold text-slate-700">{cohortData.division}</span>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Change Cohort</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl">
                <span className="text-xs text-blue-700 font-medium">Cohort Roster</span>
                <p className="text-xl font-bold text-blue-900 mt-0.5">{cohortData.total_enrolled} Students</p>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
                <span className="text-xs text-emerald-700 font-medium">To Promote</span>
                <p className="text-xl font-bold text-emerald-900 mt-0.5">{promoteCount} Students</p>
              </div>

              <div className="p-3 bg-indigo-50/60 border border-indigo-200/60 rounded-xl">
                <span className="text-xs text-indigo-700 font-medium">To Graduate (Alumni)</span>
                <p className="text-xl font-bold text-indigo-900 mt-0.5">{graduateCount} Students</p>
              </div>

              <div className="p-3 bg-rose-50/60 border border-rose-200/60 rounded-xl">
                <span className="text-xs text-rose-700 font-medium">Prior Year Arrears</span>
                <p className="text-xl font-bold text-rose-900 mt-0.5">
                  ₹{totalArrearsAmount.toLocaleString('en-IN')}{' '}
                  <span className="text-xs font-normal text-rose-600">({studentsWithArrears.length} due)</span>
                </p>
              </div>
            </div>

            {/* Bulk Action Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600 mr-1">Bulk Set:</span>
                <button
                  onClick={() => setAllActions('PROMOTE')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
                >
                  Promote All ({cohortData.students.length})
                </button>
                <button
                  onClick={() => setAllActions('GRADUATE')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
                >
                  Graduate All (Alumni)
                </button>
                <button
                  onClick={() => setAllActions('WITHDRAW')}
                  className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-all"
                >
                  Withdraw All
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search PRN or Name..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none"
                >
                  <option value="ALL">All ({cohortData.students.length})</option>
                  <option value="PROMOTE">Promote ({promoteCount})</option>
                  <option value="GRADUATE">Graduate ({graduateCount})</option>
                  <option value="WITHDRAW">Withdraw ({withdrawCount})</option>
                  <option value="ARREARS">With Arrears ({studentsWithArrears.length})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Roster List (Mobile Cards & Desktop Table) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Student & PRN</th>
                    <th className="py-3 px-3">Roll #</th>
                    <th className="py-3 px-3">Prior Year Invoiced</th>
                    <th className="py-3 px-3">Current Balance Due</th>
                    <th className="py-3 px-3">Allocated Facilities</th>
                    <th className="py-3 px-4 text-center">Rollover Action</th>
                    <th className="py-3 px-3">Concession (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((stu) => {
                    const dec = decisions[stu.student_id] || {
                      student_id: stu.student_id,
                      enrollment_id: stu.enrollment_id,
                      action: 'PROMOTE',
                      custom_concession: 0
                    };
                    const balDue = Number(stu.balance_due || 0);

                    return (
                      <tr key={stu.student_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 text-sm">{stu.student_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {stu.prn || stu.student_code} • {stu.gender}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {stu.roll_number ? `#${stu.roll_number}` : 'N/A'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 font-semibold text-slate-700">
                          ₹{Number(stu.total_invoiced || 0).toLocaleString('en-IN')}
                        </td>

                        <td className="py-3.5 px-3">
                          {balDue > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              ₹{balDue.toLocaleString('en-IN')} Due
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Cleared
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="flex flex-col space-y-1">
                            {stu.has_hostel_bed && (
                              <span className="inline-flex items-center text-[11px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium">
                                <Home className="w-3 h-3 mr-1" />
                                Bed: {stu.hostel_bed_code}
                              </span>
                            )}
                            {stu.has_study_desk && (
                              <span className="inline-flex items-center text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">
                                <Armchair className="w-3 h-3 mr-1" />
                                Desk: {stu.study_desk_code}
                              </span>
                            )}
                            {!stu.has_hostel_bed && !stu.has_study_desk && (
                              <span className="text-[11px] text-slate-400">None</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center space-x-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              onClick={() => {
                                setDecisions((prev) => ({
                                  ...prev,
                                  [stu.student_id]: { ...dec, action: 'PROMOTE' }
                                }));
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dec.action === 'PROMOTE'
                                  ? 'bg-emerald-600 text-white shadow'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Promote
                            </button>
                            <button
                              onClick={() => {
                                setDecisions((prev) => ({
                                  ...prev,
                                  [stu.student_id]: { ...dec, action: 'GRADUATE' }
                                }));
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dec.action === 'GRADUATE'
                                  ? 'bg-indigo-600 text-white shadow'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Graduate
                            </button>
                            <button
                              onClick={() => {
                                setDecisions((prev) => ({
                                  ...prev,
                                  [stu.student_id]: { ...dec, action: 'WITHDRAW' }
                                }));
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dec.action === 'WITHDRAW'
                                  ? 'bg-rose-600 text-white shadow'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Withdraw
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {dec.action === 'PROMOTE' ? (
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">
                                ₹
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={dec.custom_concession || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [stu.student_id]: { ...dec, custom_concession: val }
                                  }));
                                }}
                                placeholder="0"
                                className="w-24 pl-5 pr-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (optimized for small screen ~360px viewport) */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredStudents.map((stu) => {
                const dec = decisions[stu.student_id] || {
                  student_id: stu.student_id,
                  enrollment_id: stu.enrollment_id,
                  action: 'PROMOTE',
                  custom_concession: 0
                };
                const balDue = Number(stu.balance_due || 0);

                return (
                  <div key={stu.student_id} className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{stu.student_name}</div>
                        <div className="text-xs text-slate-500 font-mono">
                          {stu.prn || stu.student_code} • Roll #{stu.roll_number || 'N/A'}
                        </div>
                      </div>

                      {balDue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          ₹{balDue.toLocaleString('en-IN')} Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          Cleared
                        </span>
                      )}
                    </div>

                    {/* Facilities badges */}
                    {(stu.has_hostel_bed || stu.has_study_desk) && (
                      <div className="flex items-center space-x-2 text-[11px]">
                        {stu.has_hostel_bed && (
                          <span className="bg-blue-100/70 text-blue-800 px-2 py-0.5 rounded font-medium flex items-center">
                            <Home className="w-3 h-3 mr-1" /> Bed {stu.hostel_bed_code}
                          </span>
                        )}
                        {stu.has_study_desk && (
                          <span className="bg-purple-100/70 text-purple-800 px-2 py-0.5 rounded font-medium flex items-center">
                            <Armchair className="w-3 h-3 mr-1" /> Desk {stu.study_desk_code}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action 3-way toggle */}
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => {
                          setDecisions((prev) => ({
                            ...prev,
                            [stu.student_id]: { ...dec, action: 'PROMOTE' }
                          }));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                          dec.action === 'PROMOTE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Promote
                      </button>
                      <button
                        onClick={() => {
                          setDecisions((prev) => ({
                            ...prev,
                            [stu.student_id]: { ...dec, action: 'GRADUATE' }
                          }));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                          dec.action === 'GRADUATE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Graduate
                      </button>
                      <button
                        onClick={() => {
                          setDecisions((prev) => ({
                            ...prev,
                            [stu.student_id]: { ...dec, action: 'WITHDRAW' }
                          }));
                        }}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                          dec.action === 'WITHDRAW' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Nav */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Ready to configure target session and fee structure for{' '}
                <span className="font-bold text-slate-800">{promoteCount} students</span>.
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>Continue to Target & Fees</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: TARGET SESSION & FEE CONFIGURATION */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <span>Step 3: Target Session, Curriculum & Invoicing Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure target class, annual tuition fee, flexible installment schedule, and prior arrears policy for the{' '}
              <span className="font-bold text-slate-700">{promoteCount} continuing students</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Section A: Target Academic Mapping */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-2 border-b border-slate-200/80 pb-2">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Target Academic Curriculum
                </h4>
              </div>

              {/* Target Academic Year */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Academic Session *</label>
                <select
                  value={targetAcademicYearId}
                  onChange={(e) => setTargetAcademicYearId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Target Academic Year --</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>
                      {ay.name} ({ay.code}) {ay.is_current ? '• [CURRENT]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Class */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Promoted Standard / Class *</label>
                <select
                  value={targetClassId}
                  onChange={(e) => {
                    setTargetClassId(e.target.value);
                    const matching = courses.find((c) => c.class_id === e.target.value);
                    if (matching) setTargetCourseId(matching.id);
                  }}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Standard --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Course */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Course / Curriculum *</label>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Choose Curriculum Course --</option>
                  {courses
                    .filter((c) => !targetClassId || c.class_id === targetClassId)
                    .map((crs) => (
                      <option key={crs.id} value={crs.id}>
                        {crs.name} ({crs.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* Base Annual Tuition Fee */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Next-Year Annual Tuition Fee (₹) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={targetTuitionFee || ''}
                    onChange={(e) => setTargetTuitionFee(Number(e.target.value))}
                    placeholder="e.g. 32000"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Auto-filled from course base rate; editable for this rollover batch.</p>
              </div>
            </div>

            {/* Section B: Invoicing, Installments & Arrears Policy */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center space-x-2 border-b border-slate-200/80 pb-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Fee Voucher & Installment Plan
                </h4>
              </div>

              {/* Installment Scheme Buttons */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Installment Breakdown Schedule *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { count: 1, label: '1-Pay', desc: 'Full' },
                    { count: 2, label: '2-Pay', desc: 'Bi-Annual' },
                    { count: 3, label: '3-Pay', desc: 'Tri-Annual' },
                    { count: 4, label: '4-Pay', desc: 'Quarterly' }
                  ].map((inst) => (
                    <button
                      key={inst.count}
                      type="button"
                      onClick={() => setInstallmentCount(inst.count)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        installmentCount === inst.count
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{inst.label}</div>
                      <div className={`text-[10px] ${installmentCount === inst.count ? 'text-blue-100' : 'text-slate-400'}`}>
                        {inst.desc}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Live Installment Preview */}
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1 mt-2">
                  <div className="flex justify-between font-medium">
                    <span>Per-Installment Approx:</span>
                    <span className="font-bold text-slate-900">
                      ₹{targetTuitionFee > 0 ? Math.round(targetTuitionFee / installmentCount).toLocaleString('en-IN') : '0'} / installment
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Scheduled 90 days apart starting on target academic year session start date.
                  </div>
                </div>
              </div>

              {/* Prior Year Arrears Policy (The 2 requested options) */}
              <div className="space-y-2 pt-2 border-t border-slate-200/80">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Prior Year Unpaid Arrears Handling *</span>
                </label>

                <div className="space-y-2">
                  <label
                    onClick={() => setPriorDuesAction('CARRY_FORWARD')}
                    className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      priorDuesAction === 'CARRY_FORWARD'
                        ? 'bg-blue-50/70 border-blue-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="arrears_action"
                      checked={priorDuesAction === 'CARRY_FORWARD'}
                      onChange={() => setPriorDuesAction('CARRY_FORWARD')}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-800">
                        Option A: Carry forward prior dues into new invoice (Recommended)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Appends unpaid 2026–2027 balances as an arrears line item on the student's 2027–2028 invoice. No student is blocked.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => setPriorDuesAction('BLOCK_IF_DUE')}
                    className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      priorDuesAction === 'BLOCK_IF_DUE'
                        ? 'bg-amber-50/70 border-amber-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="arrears_action"
                      checked={priorDuesAction === 'BLOCK_IF_DUE'}
                      onChange={() => setPriorDuesAction('BLOCK_IF_DUE')}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-800">
                        Option B: Block promotion if prior dues exist
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Students with unpaid arrears will be skipped and held back until past balance is settled at the front desk.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Parent Notifications */}
              <div className="pt-2 border-t border-slate-200/80">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyParents}
                    onChange={(e) => setNotifyParents(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>Dispatch WhatsApp & Email Confirmation</span>
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Instantly sends promotion confirmation letter and fee voucher to parents via Meta WhatsApp & Brevo Email.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Action Strip */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-600">
              Review summary before executing: <span className="font-bold">{promoteCount} to promote</span>,{' '}
              <span className="font-bold">{graduateCount} to graduate</span>,{' '}
              <span className="font-bold">{withdrawCount} to withdraw</span>.
            </span>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white cursor-pointer"
              >
                Back to Roster
              </button>
              <button
                onClick={handleExecutePromotion}
                disabled={submitting || !targetAcademicYearId || !targetCourseId}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 transition-all ${
                  submitting || !targetAcademicYearId || !targetCourseId
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg cursor-pointer'
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Rollover & Invoicing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Execute Cohort Rollover</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: EXECUTION SUMMARY & INVOICE ROLLOUT */}
      {step === 4 && promotionResult && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="text-center space-y-2 max-w-lg mx-auto py-2">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Academic Cohort Rollover Completed!</h3>
            <p className="text-xs text-slate-500">
              Students have been transitioned, division enrollments mapped, next-year fee invoices generated, and notification dispatches enqueued.
            </p>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <span className="text-xs text-emerald-700 font-semibold uppercase">Promoted</span>
              <p className="text-2xl font-bold text-emerald-900 mt-1">{promotionResult.promoted_count}</p>
            </div>

            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <span className="text-xs text-indigo-700 font-semibold uppercase">Graduated</span>
              <p className="text-2xl font-bold text-indigo-900 mt-1">{promotionResult.graduated_count}</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-xs text-slate-700 font-semibold uppercase">Withdrawn</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{promotionResult.withdrawn_count}</p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center">
              <span className="text-xs text-blue-700 font-semibold uppercase">Total Invoiced</span>
              <p className="text-xl font-bold text-blue-900 mt-1">
                ₹{Number(promotionResult.total_invoiced_amount).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* New Invoices List */}
          {promotionResult.new_invoices.length > 0 && (
            <div className="max-w-2xl mx-auto space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Newly Generated Next-Year Invoices ({promotionResult.new_invoices.length})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                {promotionResult.new_invoices.map((inv, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{inv.student_name}</span>
                      <span className="text-slate-400 font-mono ml-2">({inv.prn})</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                        {inv.invoice_number}
                      </span>
                      <span className="font-bold text-slate-900">
                        ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finish Actions */}
          <div className="flex justify-center space-x-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setStep(1);
                setCohortData(null);
                setPromotionResult(null);
                setSourceBatchId('');
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Promote Another Cohort</span>
            </button>
          </div>
        </div>
      )}

      {/* QUICK ADD ACADEMIC YEAR MODAL */}
      {showAddAyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Create Academic Year</h3>
              </div>
              <button
                onClick={() => setShowAddAyModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Academic Year Title *</label>
                <input
                  type="text"
                  value={newAyName}
                  onChange={(e) => setNewAyName(e.target.value)}
                  placeholder="e.g. 2027-2028"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Year Code *</label>
                <input
                  type="text"
                  value={newAyCode}
                  onChange={(e) => setNewAyCode(e.target.value)}
                  placeholder="e.g. AY-2027-28"
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Session Start Date *</label>
                  <input
                    type="date"
                    value={newAyStartDate}
                    onChange={(e) => setNewAyStartDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Session End Date *</label>
                  <input
                    type="date"
                    value={newAyEndDate}
                    onChange={(e) => setNewAyEndDate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddAyModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAcademicYear}
                disabled={creatingAy || !newAyName || !newAyCode}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow cursor-pointer flex items-center space-x-1.5"
              >
                {creatingAy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create Session</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
