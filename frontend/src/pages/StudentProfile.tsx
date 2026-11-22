import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User,
  GraduationCap,
  Layers,
  Home,
  Armchair,
  DollarSign,
  CreditCard,
  CalendarCheck,
  Award,
  FileText,
  History,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  CheckCircle,
  XCircle,
  BookOpen,
  Percent,
  Check,
  X,
  TrendingUp,
  Sparkles,
  FileCheck,
  Search,
  ArrowLeft,
  Printer,
  Users,
  Edit3,
  Trash2,
  School,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import api from '../api/client';
import { EditStudentModal } from '../components/EditStudentModal';
import { DeleteStudentModal } from '../components/DeleteStudentModal';
import { InvoiceDetailModal } from '../components/InvoiceDetailModal';
import { PaymentReceiptModal } from '../components/PaymentReceiptModal';
import { StudentAdmissionFormModal } from '../components/StudentAdmissionFormModal';

export const StudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [attStatusFilter, setAttStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL');
  const [examStatusFilter, setExamStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'ABSENT'>('ALL');
  const [examCourseFilter, setExamCourseFilter] = useState<string>('ALL');
  const [examSubjectFilter, setExamSubjectFilter] = useState<string>('ALL');
  const [examSearch, setExamSearch] = useState('');

  // Invoice, Receipt & Admission Form Print Modals
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isAdmissionFormOpen, setIsAdmissionFormOpen] = useState(false);

  useEffect(() => {
    const autoOpen = searchParams.get('openInvoice');
    if (autoOpen) {
      setSelectedInvoiceId(autoOpen);
    }
    if (searchParams.get('openAdmissionForm') === 'true') {
      setIsAdmissionFormOpen(true);
    }
  }, [searchParams]);

  // Modals & Feedback
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mid-Session Skill Course Enrollment
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillCourses, setSkillCourses] = useState<any[]>([]);
  const [selectedSkillCourseId, setSelectedSkillCourseId] = useState('');
  const [skillBatches, setSkillBatches] = useState<any[]>([]);
  const [selectedSkillBatchId, setSelectedSkillBatchId] = useState('');
  const [skillDiscount, setSkillDiscount] = useState<number>(0);
  const [skillInstallments, setSkillInstallments] = useState<number>(1);
  const [billingMode, setBillingMode] = useState<'SEPARATE_INVOICE' | 'MERGE_INTO_OPEN_INVOICE'>('SEPARATE_INVOICE');
  const [selectedTargetInvoiceId, setSelectedTargetInvoiceId] = useState<string>('');
  const [skillSubmitting, setSkillSubmitting] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  // Provisional Trial Conversion & Dropout State
  const [showConvertTrialModal, setShowConvertTrialModal] = useState(false);
  const [convertInstallments, setConvertInstallments] = useState(1);
  const [convertDiscount, setConvertDiscount] = useState(0);
  const [convertCustomInstallments, setConvertCustomInstallments] = useState<any[]>([]);
  const [convertingTrial, setConvertingTrial] = useState(false);
  const [closingTrial, setClosingTrial] = useState(false);
  const [trialConvertError, setTrialConvertError] = useState<string | null>(null);

  const getConvertDefaultInstallments = (count: number, anchorDate?: string) => {
    const anchor = anchorDate || profile?.overview?.admission_date || new Date().toISOString().split('T')[0];
    const base = new Date(anchor + 'T00:00:00');
    const list = [];
    for (let i = 1; i <= count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + (i - 1) * 30);
      list.push({
        installment_number: i,
        due_date: d.toISOString().split('T')[0],
        amount: undefined as number | undefined
      });
    }
    return list;
  };

  const handleConvertInstallmentCountChange = (count: number) => {
    setConvertInstallments(count);
    setConvertCustomInstallments(getConvertDefaultInstallments(count));
  };

  const handleConvertTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enrId = primaryAcademic?.enrollment_id;
    if (!enrId) {
      setTrialConvertError('Could not locate active provisional enrollment ID');
      return;
    }
    setConvertingTrial(true);
    setTrialConvertError(null);
    try {
      const payload: any = {
        discount_amount: convertDiscount || 0,
        number_of_installments: convertInstallments,
        custom_installments: convertInstallments > 1 && convertCustomInstallments.length === convertInstallments ? convertCustomInstallments : undefined,
        joining_date: profile?.overview?.admission_date
      };
      await api.post(`/enrollments/${enrId}/convert-trial`, payload);
      setFeedbackNotice({ type: 'success', message: 'Provisional trial converted to permanent admission successfully! Tuition invoice issued.' });
      setShowConvertTrialModal(false);
      fetchProfile();
    } catch (err: any) {
      setTrialConvertError(err.response?.data?.detail || 'Failed to convert trial admission');
    } finally {
      setConvertingTrial(false);
    }
  };

  const handleCloseTrial = async () => {
    const enrId = primaryAcademic?.enrollment_id;
    if (!enrId) return;
    const confirmed = window.confirm(
      'Are you sure you want to close this provisional trial? The student will be marked as TRIAL_DROPOUT, removed from class attendance rolls, and ₹0 tuition debts will be created. The registration form fee remains with the institute.'
    );
    if (!confirmed) return;
    setClosingTrial(true);
    try {
      await api.post(`/enrollments/${enrId}/close-trial`, {
        reason: 'Student dropped out after trial period'
      });
      setFeedbackNotice({ type: 'success', message: 'Trial closed cleanly. Student marked as TRIAL_DROPOUT with zero financial debt.' });
      fetchProfile();
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', message: err.response?.data?.detail || 'Failed to close trial' });
    } finally {
      setClosingTrial(false);
    }
  };

  const openSkillEnrollModal = async () => {
    setSkillError(null);
    setSelectedSkillCourseId('');
    setSelectedSkillBatchId('');
    setSkillDiscount(0);
    setSkillInstallments(1);

    const openInvs = (profile?.fees || []).filter((f: any) =>
      ['ISSUED', 'PARTIALLY_PAID'].includes(f.status) &&
      Number(f.balance_amount) > 0
    );
    if (openInvs.length > 0) {
      setSelectedTargetInvoiceId(openInvs[0].id);
      setBillingMode('SEPARATE_INVOICE');
    } else {
      setSelectedTargetInvoiceId('');
      setBillingMode('SEPARATE_INVOICE');
    }

    try {
      const res = await api.get('/academics/courses', { params: { is_universal: true } });
      setSkillCourses(res.data || []);
      setShowSkillModal(true);
    } catch (e: any) {
      console.error('Failed to load universal courses', e);
    }
  };

  useEffect(() => {
    if (selectedSkillCourseId) {
      api.get('/academics/batches', { params: { course_id: selectedSkillCourseId, is_active: true } })
        .then((res) => {
          setSkillBatches(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedSkillBatchId(res.data[0].id);
          } else {
            setSelectedSkillBatchId('');
          }
        })
        .catch(() => setSkillBatches([]));
    } else {
      setSkillBatches([]);
      setSelectedSkillBatchId('');
    }
  }, [selectedSkillCourseId]);

  const handleConfirmSkillEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkillCourseId) {
      setSkillError('Please select a skill course');
      return;
    }
    setSkillSubmitting(true);
    setSkillError(null);
    try {
      const payload: any = {
        student_id: id,
        course_id: selectedSkillCourseId,
        batch_id: selectedSkillBatchId || undefined,
        discount_amount: Number(skillDiscount) || 0,
        billing_mode: billingMode,
      };

      if (billingMode === 'MERGE_INTO_OPEN_INVOICE') {
        payload.target_invoice_id = selectedTargetInvoiceId || undefined;
      } else {
        payload.number_of_installments = Number(skillInstallments) || 1;
      }

      const res = await api.post('/enrollments/add-skill-course', payload);
      setShowSkillModal(false);
      setFeedbackNotice({
        type: 'success',
        message: res.data.message || `Successfully enrolled in ${res.data.course_name}!`
      });
      // Refresh profile data
      if (id) {
        const pRes = await api.get(`/students/${id}/profile`);
        setProfile(pRes.data);
      }
      // Open the new or updated invoice
      if (res.data.invoice_id) {
        setSelectedInvoiceId(res.data.invoice_id);
      }
    } catch (err: any) {
      console.error(err);
      setSkillError(err.response?.data?.detail || 'Failed to enroll student in skill course');
    } finally {
      setSkillSubmitting(false);
    }
  };

  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchProfile = async () => {
    if (!id) return;
    try {
      setRefreshing(true);
      const res = await api.get(`/students/${id}/profile`);
      setProfile(res.data);
    } catch (err) {
      console.error('Failed to fetch student profile', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProfile().finally(() => setLoading(false));
    }
  }, [id]);

  const isInitialMount = useRef(true);

  // Background re-fetch fresh profile data whenever user switches tabs
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (id) {
      fetchProfile();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-xs text-slate-500">Student record not found.</p>
        <Link to="/students" className="mt-2 inline-block text-xs font-semibold text-emerald-600 hover:underline">
          Back to Students Registry
        </Link>
      </div>
    );
  }

  const { overview, academics, services, hostel, study_room, fees, payments, attendance, examinations, documents, activity_history } = profile;

  // Prioritize primary core academic curriculum (e.g. 8th Standard) over elective / universal skill courses
  const primaryAcademic = academics.find((a: any) => !a.is_universal && a.status === 'ACTIVE')
    || academics.find((a: any) => !a.is_universal)
    || academics[0];

  const skillAcademics = academics.filter((a: any) => a.enrollment_id !== primaryAcademic?.enrollment_id && a.status === 'ACTIVE');

  const tabs = [
    { id: 'overview', label: '1. Overview', icon: User },
    { id: 'academics', label: '2. Academics', icon: GraduationCap },
    { id: 'services', label: '3. Services', icon: Layers },
    { id: 'hostel', label: '4. Hostel', icon: Home },
    { id: 'study_room', label: '5. Study Room', icon: Armchair },
    { id: 'fees', label: '6. Fees & Invoices', icon: DollarSign },
    { id: 'payments', label: '7. Payments & Receipts', icon: CreditCard },
    { id: 'attendance', label: '8. Attendance', icon: CalendarCheck },
    { id: 'examinations', label: '9. Examinations', icon: Award },
    { id: 'documents', label: '10. Documents', icon: FileText },
    { id: 'history', label: '11. Activity History', icon: History }
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Toast / Notification Banner */}
      {feedbackNotice && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition animate-in fade-in ${
          feedbackNotice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{feedbackNotice.message}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Student Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5 sm:gap-6 w-full">
        <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-lg sm:text-2xl shadow-md shadow-emerald-500/20 shrink-0">
            {overview.first_name[0]}{overview.last_name[0]}
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{overview.first_name} {overview.last_name}</h2>
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                overview.status === 'PROVISIONAL_TRIAL'
                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                  : overview.status === 'TRIAL_DROPOUT'
                  ? 'bg-slate-100 text-slate-600 border border-slate-300'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {overview.status === 'PROVISIONAL_TRIAL' ? '⏳ PROVISIONAL TRIAL' : overview.status === 'TRIAL_DROPOUT' ? 'TRIAL DROPOUT' : overview.status}
              </span>
              {overview.prn && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  PRN: {overview.prn}
                </span>
              )}
              {overview.roll_number && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  Roll #{overview.roll_number} {overview.division ? `(Div ${overview.division})` : ''}
                </span>
              )}
            </div>

            {/* Quick Contact Chips Row */}
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-slate-500">
              {overview.mobile && (
                <span className="inline-flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{overview.mobile}</span>
                </span>
              )}
              {overview.email && (
                <span className="inline-flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate max-w-[180px] sm:max-w-none">{overview.email}</span>
                </span>
              )}
              <span className="inline-flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>DOB: {overview.date_of_birth}</span>
              </span>
              <span className="inline-flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Enrolled: {overview.admission_date}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Subscribed Facility Badges & Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 xl:self-center">
          {/* Active Facility Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {primaryAcademic && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs" title={primaryAcademic.course_name || primaryAcademic.class_name}>
                <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate max-w-[200px]">{primaryAcademic.course_name || primaryAcademic.class_name || 'ACADEMIC ENROLLED'}</span>
              </span>
            )}
            {skillAcademics.map((sk: any) => (
              <span
                key={sk.enrollment_id}
                className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                title={`Skill / Universal Course: ${sk.course_name}`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate max-w-[200px]">{sk.course_name}</span>
              </span>
            ))}
            {hostel && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <Home className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>HOSTEL BED #{hostel.bed_number}</span>
              </span>
            )}
            {study_room && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
                <Armchair className="w-4 h-4 text-purple-600 shrink-0" />
                <span>DESK #{study_room.seat_number}</span>
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 sm:pt-0 sm:border-l sm:pl-3 border-slate-200">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition shadow-xs cursor-pointer"
              title="Edit Student Demographics & Profile"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition shadow-xs cursor-pointer"
              title="Delete Student Record"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Delete</span>
            </button>
            <Link
              to="/students"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
              title="Return to Students Registry"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
              <span>Registry</span>
            </Link>
            <button
              onClick={() => setIsAdmissionFormOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs cursor-pointer"
              title="Print Official Student Admission Form / Dossier"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Dossier</span>
            </button>
            <button
              onClick={fetchProfile}
              disabled={refreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs cursor-pointer"
              title="Refresh Student Profile & Live Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Provisional Trial Active Banner */}
      {overview.status === 'PROVISIONAL_TRIAL' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-500/10 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-md shadow-amber-500/25">
                ⏳
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-xs font-black tracking-wider uppercase text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Provisional Trial Active
                  </span>
                  {overview.trial_end_date && (
                    <span className="text-xs font-bold text-amber-800">
                      • Expires on {overview.trial_end_date}
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-950/80 leading-relaxed">
                  Student is currently attending trial lectures with <strong>₹0 tuition liability</strong>. One-Time Registration Form Fee: <strong className="text-emerald-700 font-bold">₹200 Paid</strong> (Receipt: <code className="font-mono font-bold text-slate-800">{overview.trial_receipt_number || 'REC-FORM-PAID'}</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setConvertInstallments(1);
                  setConvertDiscount(0);
                  setConvertCustomInstallments(getConvertDefaultInstallments(1));
                  setShowConvertTrialModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Full Admission</span>
              </button>
              <button
                type="button"
                disabled={closingTrial}
                onClick={handleCloseTrial}
                className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-slate-300 text-slate-700 hover:text-rose-700 text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>{closingTrial ? 'Closing...' : 'Close Trial (Dropout)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Dropout Notice */}
      {overview.status === 'TRIAL_DROPOUT' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
              Trial Discontinued
            </span>
            <span>Student discontinued after the trial period. No tuition invoices or debts created. Form fee retained by institute.</span>
          </div>
          {overview.trial_receipt_number && (
            <span className="font-mono text-[11px] text-slate-500">
              Form Fee Receipt: {overview.trial_receipt_number}
            </span>
          )}
        </div>
      )}

      {/* 11 Tabs Navigation & Content Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Horizontally Scrollable Tabs Strip (Only the tabs scroll on small screens) */}
        <div className="overflow-x-auto border-b border-slate-100">
          <div className="flex space-x-1 p-2 min-w-max">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                    activeTab === t.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stable Tab Content Panel (Stays firmly pinned and never shifts horizontally) */}
        <div className="p-4 sm:p-6 w-full">
          {/* TAB 1: OVERVIEW - Comprehensive Student Profile Cards */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* 1. Demographics & Bio */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Demographics &amp; Bio</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-semibold text-slate-800">{overview.gender || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Date of Birth</span>
                    <span className="font-semibold text-slate-800">{overview.date_of_birth || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Blood Group</span>
                    <span className="font-semibold text-slate-800">{overview.blood_group || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Aadhar / National ID</span>
                    <span className="font-mono font-semibold text-slate-800">{overview.aadhar_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Social Category</span>
                    <span className="font-semibold text-slate-800">{overview.category || 'GENERAL'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Admission Date</span>
                    <span className="font-semibold text-slate-800">{overview.admission_date || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Enrollment Status</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {overview.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Current Regular Education (School / Junior College) */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center space-x-2">
                    <School className="w-4 h-4 text-purple-600" />
                    <h4 className="font-bold text-slate-900 text-sm">Current Regular Education</h4>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    overview.institution_type === 'COLLEGE'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {overview.institution_type === 'COLLEGE' ? 'Junior College (11th–12th)' : 'School (5th–10th)'}
                  </span>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      {overview.institution_type === 'COLLEGE' ? 'Attending Junior College:' : 'Attending School:'}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {overview.school_college_name || 'Not Specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Education Board / Affiliation:</span>
                    <span className="font-semibold text-slate-800">
                      {overview.education_board === 'STATE_BOARD'
                        ? 'Maharashtra State Board (SSC/HSC)'
                        : overview.education_board === 'CBSE'
                        ? 'CBSE (Central Board)'
                        : overview.education_board === 'ICSE'
                        ? 'ICSE / ISC'
                        : overview.education_board === 'IB_IGCSE'
                        ? 'IB / Cambridge IGCSE'
                        : overview.education_board || 'State Board'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      {overview.institution_type === 'COLLEGE' ? 'Previous College / 10th Percentage:' : 'Previous School Percentage:'}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {overview.previous_percentage != null ? `${overview.previous_percentage}%` : 'Not Specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Attendance Mode:</span>
                    <span className="font-semibold text-slate-700">Regular Day Student (Parallel Coaching)</span>
                  </div>
                  <div className="p-2 bg-purple-50/60 rounded-lg border border-purple-100 text-[11px] text-purple-800">
                    Day school / college schedule synchronized with academy batch timing.
                  </div>
                </div>
              </div>

              {/* 3. Academy Classroom & Cohort */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Academy Classroom &amp; Cohort</h4>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Enrolled Grade</span>
                    <span className="font-semibold text-slate-800">
                      {academics[0]?.class_name || (services?.length > 0 ? 'Facility Only (Hostel / Study Room)' : 'Standard')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Division Batch</span>
                    <span className="font-semibold text-slate-800">
                      {overview.batch_name || (academics.length === 0 ? 'No Classroom Batch' : 'Primary Section')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Roll Number</span>
                    <span className="font-mono font-bold text-blue-700">
                      {overview.roll_number ? `#${overview.roll_number}` : 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">PRN Code</span>
                    <span className="font-mono text-[11px] font-bold text-purple-700">
                      {overview.prn || overview.student_code}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Guardian & Emergency Contacts */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Guardians &amp; Emergency</h4>
                </div>
                {overview.guardians && overview.guardians.length > 0 ? (
                  <div className="space-y-2">
                    {overview.guardians.map((g: any) => (
                      <div key={g.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-slate-900">{g.name}</p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            {g.relation}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{g.mobile}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">No guardian records found.</p>
                )}

                {/* Emergency Contact */}
                {(overview.emergency_contact_name || overview.emergency_contact_phone) && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Emergency Contact</p>
                    <div className="p-2 bg-rose-50/60 rounded-lg border border-rose-100 text-[11px] space-y-0.5">
                      <p className="font-bold text-slate-900">
                        {overview.emergency_contact_name || 'Emergency Contact'}{' '}
                        {overview.emergency_contact_relation && (
                          <span className="font-normal text-rose-700">({overview.emergency_contact_relation})</span>
                        )}
                      </p>
                      {overview.emergency_contact_phone && (
                        <p className="text-slate-600 font-mono flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-rose-500" />
                          <span>{overview.emergency_contact_phone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Residential Address & Contacts */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Residence &amp; Contacts</h4>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Direct Mobile:</span>
                    <span className="font-semibold text-slate-800 font-mono">{overview.mobile || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Primary Email:</span>
                    <span className="font-semibold text-slate-800 break-all">{overview.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Native / Residential Address:</span>
                    <div className="font-semibold text-slate-800 space-y-0.5 mt-0.5">
                      {overview.village || overview.taluka || overview.district ? (
                        <p>
                          {[
                            overview.village && `At/Post: ${overview.village}`,
                            overview.taluka && `Taluka: ${overview.taluka}`,
                            overview.district && `Dist: ${overview.district}`
                          ].filter(Boolean).join(', ')}
                        </p>
                      ) : overview.address ? (
                        <p>{overview.address}</p>
                      ) : (
                        <p className="text-slate-400 italic">No native address recorded</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACADEMICS */}
          {activeTab === 'academics' && (
            <div className="space-y-4 text-xs">
              {overview.batch_name && (
                <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Assigned Teaching Batch &amp; Course Validity</p>
                    <p className="text-sm font-bold text-slate-900">{overview.batch_name} — Division {overview.division || 'A'}</p>
                    {overview.batch_start_date && overview.batch_end_date && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                        <span>Duration: <strong className="text-slate-700">{overview.batch_start_date}</strong> → <strong className="text-slate-700">{overview.batch_end_date}</strong></span>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          if (today > overview.batch_end_date) {
                            return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">Course Expired</span>;
                          }
                          const days = Math.ceil((new Date(overview.batch_end_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
                          return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Active ({days}d remaining)</span>;
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Class Roll Number</span>
                    <span className="text-base font-mono font-bold text-blue-700">
                      {overview.roll_number ? `Roll #${overview.roll_number}` : 'Unassigned'}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="font-bold text-slate-900">Academic Enrollments &amp; Curriculum Record</h4>
                <button
                  type="button"
                  onClick={openSkillEnrollModal}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+ Enroll in Skill Course</span>
                </button>
              </div>
              {academics.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <Armchair className="w-8 h-8 text-purple-600 mx-auto" />
                  <p className="font-bold text-slate-800 text-sm">Facility-Only Student</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    This student is currently admitted exclusively for Facility Services (Hostel &amp; Study Room). You can click "+ Enroll in Skill Course" above at any time to add a curriculum or universal skill program.
                  </p>
                </div>
              ) : (
                academics.map((enr: any) => (
                <div key={enr.enrollment_id} className="p-4 bg-slate-50 border rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      {enr.class_name ? (
                        `${enr.class_name} • ${enr.stream_name || 'General'}`
                      ) : (
                        <span className="inline-flex items-center gap-1 text-purple-700 font-bold">
                          🌐 Universal / Skill Program
                        </span>
                      )}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      enr.is_universal ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {enr.status}
                    </span>
                  </div>
                  {enr.enrollment_type === 'COMBINED_MULTI_YEAR' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold w-fit">
                      <span>🎓</span>
                      <span>{enr.group_remarks || 'Multi-Year Combined Program'} (2-Year Package)</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
                    <p>Course Offering: <strong className="text-slate-800">{enr.course_name || 'Configured Subjects'}</strong></p>
                    {enr.start_date && enr.end_date && (
                      <p className="flex items-center gap-1.5">
                        <span>Period: <strong>{enr.start_date}</strong> → <strong>{enr.end_date}</strong></span>
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          if (today > enr.end_date) {
                            return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Expired</span>;
                          }
                          return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Current</span>;
                        })()}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 mb-1">Enrolled Subjects:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {enr.subjects.map((sub: any) => (
                        <span key={sub.id} className="px-2 py-1 bg-white border rounded text-[11px] font-medium text-slate-800">
                          {sub.name} ({sub.code})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )))}
            </div>
          )}

          {/* TAB 3: SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-4 text-xs">
              <h4 className="font-bold text-slate-900 border-b pb-2">Active Facility Subscriptions</h4>
              {services.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {services.map((s: any) => (
                    <div key={s.id} className="p-4 border rounded-xl bg-white shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{s.service_type}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 font-semibold">{s.status}</span>
                      </div>
                      <p className="text-slate-600 font-medium">{s.plan_name}</p>
                      <p className="text-slate-500 text-[11px]">₹{s.unit_price} / {s.billing_frequency}</p>
                      <p className="text-slate-400 text-[10px] pt-1 border-t">Valid: {s.start_date} to {s.end_date}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="font-semibold text-slate-700">No Auxiliary Facility Subscriptions</p>
                  <p className="text-slate-400 max-w-md mx-auto">
                    Student is not subscribed to auxiliary campus facilities (Hostel Boarding, Study Room Desk, Mess, Transport). Academic coaching courses and batches are managed under Tab 2 (Academics).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HOSTEL */}
          {activeTab === 'hostel' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">Hostel Tenancy & Bed Details</h4>
              {hostel ? (
                <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="font-bold text-emerald-900 text-sm">Active Bed Assignment</p>
                  <p><strong className="text-slate-700">Room:</strong> {hostel.room_number}</p>
                  <p><strong className="text-slate-700">Bed Number:</strong> {hostel.bed_number}</p>
                  <p><strong className="text-slate-700">Period:</strong> {hostel.start_date} to {hostel.end_date}</p>
                </div>
              ) : (
                <p className="text-slate-500">Student is not currently enrolled in hostel boarding.</p>
              )}
            </div>
          )}

          {/* TAB 5: STUDY ROOM */}
          {activeTab === 'study_room' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">Study Room Desk Lease Details</h4>
              {study_room ? (
                <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
                  <p className="font-bold text-purple-900 text-sm">Assigned Study Desk #{study_room.seat_number}</p>
                  <p><strong className="text-slate-700">Gender Allocation:</strong> {study_room.gender_allowed}</p>
                  <p><strong className="text-slate-700">Power Outlet:</strong> {study_room.has_power_outlet ? 'Yes (240V Dedicated)' : 'No'}</p>
                  <p><strong className="text-slate-700">Validity:</strong> {study_room.start_date} to {study_room.end_date}</p>
                </div>
              ) : (
                <p className="text-slate-500">Student is not currently subscribed to the study room facility.</p>
              )}
            </div>
          )}

          {/* TAB 6: FEES */}
          {activeTab === 'fees' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">Invoices & Billing Obligations</h4>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Issued Date</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5 text-right">Total (₹)</th>
                    <th className="p-2.5 text-right">Paid (₹)</th>
                    <th className="p-2.5 text-right">Balance (₹)</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {fees.map((inv: any) => (
                    <React.Fragment key={inv.id}>
                      <tr>
                        <td className="p-2.5 font-mono font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="hover:text-emerald-700 hover:underline inline-flex items-center space-x-1"
                            title="Click to Print Dual-Copy Invoice"
                          >
                            <span>{inv.invoice_number}</span>
                            <Printer className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="p-2.5 text-slate-500">{inv.issue_date}</td>
                        <td className="p-2.5 text-slate-500">{inv.due_date}</td>
                        <td className="p-2.5 text-right font-semibold">₹{inv.total_amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-emerald-600 font-semibold">₹{inv.paid_amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-right text-rose-600 font-semibold">₹{inv.balance_amount.toLocaleString('en-IN')}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100">{inv.status}</span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition"
                            title="Print Dual-Copy (Student + Office) Invoice"
                          >
                            <Printer className="w-3 h-3 text-slate-500" />
                            <span>Print</span>
                          </button>
                        </td>
                      </tr>
                      {inv.installments && inv.installments.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="px-4 py-2 border-b">
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="text-slate-400 font-medium">Installment Schedule:</span>
                              {[...(inv.installments || [])].sort((a: any, b: any) => a.installment_number - b.installment_number).map((inst: any) => (
                                <span
                                  key={inst.id}
                                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                                    inst.status === 'PAID'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : inst.status === 'OVERDUE'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span className="font-bold">Inst #{inst.installment_number}:</span>
                                  <span>₹{inst.amount.toLocaleString('en-IN')}</span>
                                  <span className="text-[10px] text-slate-400">({inst.due_date})</span>
                                  <span className="font-semibold text-[9px] uppercase">[{inst.status}]</span>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 7: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">Payment Receipts & Ledgers</h4>
              <div className="divide-y border rounded-xl overflow-hidden">
                {payments.map((p: any) => (
                  <div key={p.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-bold text-slate-900 font-mono">{p.payment_number}</p>
                      <p className="text-slate-500">{p.payment_date} • {p.payment_method}</p>
                    </div>
                    <div className="flex items-center space-x-3 text-right">
                      <div>
                        <p className="font-bold text-emerald-600 text-sm">₹{p.amount.toLocaleString('en-IN')}</p>
                        <span className="text-[10px] text-slate-400">{p.status}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentId(p.id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition"
                        title="Print Official Payment Receipt"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Header with Title and Standing Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <CalendarCheck className="w-4 h-4 text-teal-600" />
                    <span>Academic Attendance &amp; Turnout Ledger</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time lecture attendance records, turnout statistics, and date-wise session breakdown.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {!attendance || attendance.total_sessions === 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      No Attendance Sessions Yet
                    </span>
                  ) : attendance.attendance_percentage >= 75 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● Standing: Regular ({(attendance.attendance_percentage || 0).toFixed(1)}%)
                    </span>
                  ) : attendance.attendance_percentage >= 60 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ▲ Standing: Warning ({(attendance.attendance_percentage || 0).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      ✕ Standing: Critical Defaulter ({(attendance.attendance_percentage || 0).toFixed(1)}%)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={fetchProfile}
                    disabled={refreshing}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg border border-slate-200 transition"
                    title="Refresh Live Attendance Records"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 4 Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Overall Percentage */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Overall Rate</span>
                    <Percent className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900">
                      {(attendance?.attendance_percentage || 100).toFixed(1)}%
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {attendance?.attended_sessions ?? attendance?.present_sessions ?? 0} of {attendance?.total_sessions || 0} Lectures Attended
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (attendance?.attendance_percentage || 100) >= 75
                          ? 'bg-emerald-500'
                          : (attendance?.attendance_percentage || 100) >= 60
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, attendance?.attendance_percentage || 100)}%` }}
                    />
                  </div>
                </div>

                {/* 2. Present Sessions */}
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Present</span>
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-emerald-700">
                      {attendance?.present_sessions || 0}
                    </p>
                    <p className="text-[11px] text-emerald-600/90 font-medium">
                      Sessions on time
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    {attendance?.total_sessions > 0
                      ? `${Math.round(((attendance?.present_sessions || 0) / attendance.total_sessions) * 100)}% of total`
                      : '100%'}
                  </span>
                </div>

                {/* 3. Absent Sessions */}
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Absent</span>
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-rose-700">
                      {attendance?.absent_sessions || 0}
                    </p>
                    <p className="text-[11px] text-rose-600/90 font-medium">
                      Missed lectures
                    </p>
                  </div>
                  <span className="text-[10px] text-rose-700 font-semibold">
                    {attendance?.total_sessions > 0
                      ? `${Math.round(((attendance?.absent_sessions || 0) / attendance.total_sessions) * 100)}% absent rate`
                      : '0%'}
                  </span>
                </div>

                {/* 4. Late Arrivals */}
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Late</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-amber-700">
                      {attendance?.late_sessions || 0}
                    </p>
                    <p className="text-[11px] text-amber-600/90 font-medium">
                      Late check-ins
                    </p>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold">
                    Counted in attendance
                  </span>
                </div>
              </div>

              {/* Subject-Wise Turnout Breakdown (if available) */}
              {attendance?.subject_breakdown && attendance.subject_breakdown.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Subject-Wise Attendance Breakdown</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {attendance.subject_breakdown.map((sb: any) => (
                      <div key={sb.subject_name} className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-900 text-xs">{sb.subject_name}</span>
                          <span className="font-bold text-xs text-slate-700">{sb.percentage}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full ${
                              sb.percentage >= 75 ? 'bg-emerald-500' : sb.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, sb.percentage)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>{sb.present_sessions} / {sb.total_sessions} Attended</span>
                          {sb.absent_sessions > 0 && (
                            <span className="text-rose-600 font-medium">{sb.absent_sessions} Absent</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Attendance History Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-slate-500" />
                    <span className="font-bold text-slate-900 text-xs">
                      Daily Attendance History ({attendance?.records ? attendance.records.length : 0} Sessions)
                    </span>
                  </div>

                  {/* Filter Badges */}
                  <div className="flex items-center space-x-1.5">
                    {(['ALL', 'PRESENT', 'ABSENT', 'LATE'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAttStatusFilter(st)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                          attStatusFilter === st
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {st === 'ALL' ? 'All Logs' : st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table or Empty State */}
                {(() => {
                  const filteredRecords = (attendance?.records || []).filter((r: any) => {
                    if (attStatusFilter !== 'ALL' && r.status !== attStatusFilter) return false;
                    return true;
                  });

                  if (filteredRecords.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-400 space-y-2">
                        <CalendarCheck className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">
                          {attendance?.records && attendance.records.length > 0
                            ? `No records found with status '${attStatusFilter}'.`
                            : 'No attendance records logged for this student yet.'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Sessions marked in the Academic Attendance Terminal will automatically populate here in real time.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3.5">Session Date</th>
                            <th className="py-2.5 px-3.5">Subject &amp; Batch</th>
                            <th className="py-2.5 px-3.5">Curriculum / Topic Covered</th>
                            <th className="py-2.5 px-3.5">Attendance Status</th>
                            <th className="py-2.5 px-3.5">Faculty / Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRecords.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Session Date */}
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="font-semibold text-slate-900 font-mono text-xs">
                                    {r.date}
                                  </span>
                                </div>
                              </td>

                              {/* Subject & Batch */}
                              <td className="py-3 px-3.5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {r.subject_name}
                                  </span>
                                  {r.batch_name && (
                                    <span className="text-[10px] text-slate-400">
                                      {r.batch_name}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Topic Covered */}
                              <td className="py-3 px-3.5 max-w-xs truncate text-slate-700">
                                <span title={r.topic_covered}>
                                  {r.topic_covered || 'Standard Syllabus Session'}
                                </span>
                              </td>

                              {/* Turnout Status Badge */}
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                {r.status === 'PRESENT' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 space-x-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>PRESENT</span>
                                  </span>
                                )}
                                {r.status === 'ABSENT' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 space-x-1">
                                    <X className="w-3 h-3 text-rose-600" />
                                    <span>ABSENT</span>
                                  </span>
                                )}
                                {r.status === 'LATE' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 space-x-1">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>LATE</span>
                                  </span>
                                )}
                                {r.status === 'EXCUSED_LEAVE' && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 space-x-1">
                                    <Calendar className="w-3 h-3 text-blue-600" />
                                    <span>EXCUSED</span>
                                  </span>
                                )}
                              </td>

                              {/* Teacher / Remarks */}
                              <td className="py-3 px-3.5 text-slate-500 text-[11px]">
                                {r.teacher_name ? (
                                  <span>{r.teacher_name}{r.remarks ? ` • ${r.remarks}` : ''}</span>
                                ) : (
                                  <span>{r.remarks || '—'}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 9: EXAMINATIONS */}
          {activeTab === 'examinations' && (() => {
            const examList = (examinations || []) as any[];
            const totalTests = examList.length;

            // Extract all enrolled courses and exam courses
            const enrolledCourses = Array.from(new Set((academics || []).map((a: any) => a.course_name).filter(Boolean))) as string[];
            const examCourses = Array.from(new Set(examList.map((e: any) => e.course_name).filter(Boolean))) as string[];
            const allAvailableCourses = Array.from(new Set([...enrolledCourses, ...examCourses]));

            // Filter exams by selected course
            const courseExams = examList.filter((e) => {
              if (examCourseFilter === 'ALL') return true;
              return (e.course_name || '') === examCourseFilter;
            });

            // Extract subjects available under the filtered course
            const availableSubjects = Array.from(
              new Set(courseExams.map((e) => e.subject_name).filter(Boolean))
            ) as string[];

            // Recalculate KPIs based on selected course
            const totalTestsInCourse = courseExams.length;
            const evaluatedTests = courseExams.filter((e) => !e.is_absent);
            const passedTests = evaluatedTests.filter((e) => e.is_pass).length;
            const failedTests = evaluatedTests.filter((e) => !e.is_pass).length;
            const absentTests = courseExams.filter((e) => e.is_absent).length;
            const avgPct = evaluatedTests.length > 0
              ? Math.round(evaluatedTests.reduce((acc, curr) => acc + Number(curr.percentage || 0), 0) / evaluatedTests.length)
              : 0;
            const maxPct = evaluatedTests.length > 0
              ? Math.max(...evaluatedTests.map((e) => Number(e.percentage || 0)))
              : 0;

            // Filter for table: Subject, Status, Search
            const filteredExams = courseExams.filter((e) => {
              if (examSubjectFilter !== 'ALL' && e.subject_name !== examSubjectFilter) return false;
              if (examStatusFilter === 'PASSED' && (!e.is_pass || e.is_absent)) return false;
              if (examStatusFilter === 'FAILED' && (e.is_pass || e.is_absent)) return false;
              if (examStatusFilter === 'ABSENT' && !e.is_absent) return false;
              if (examSearch) {
                const q = examSearch.toLowerCase();
                const matchName = (e.exam_name || '').toLowerCase().includes(q);
                const matchSubj = (e.subject_name || '').toLowerCase().includes(q);
                const matchCode = (e.exam_code || '').toLowerCase().includes(q);
                if (!matchName && !matchSubj && !matchCode) return false;
              }
              return true;
            });

            return (
              <div className="space-y-4 text-xs">
                {/* Header & KPI Summary */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                      <Award className="w-4 h-4 text-purple-600" />
                      <span>Assessment Results & Test Marks</span>
                    </h4>
                    <p className="text-slate-500 mt-0.5">
                      Evaluated test papers, chapter assessments, and examination report cards.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-100">
                      {totalTests} Tests Recorded
                    </span>
                    <button
                      type="button"
                      onClick={fetchProfile}
                      disabled={refreshing}
                      className="p-1.5 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg border border-slate-200 transition"
                      title="Refresh Assessment Records"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Enrolled Course-Wise Filter Bar */}
                {allAvailableCourses.length > 0 && (
                  <div className="p-3 bg-purple-50/40 border border-purple-100 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                        <span>Filter by Enrolled Course Curriculum</span>
                      </span>
                      {examCourseFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => {
                            setExamCourseFilter('ALL');
                            setExamSubjectFilter('ALL');
                          }}
                          className="text-[10px] font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                        >
                          Reset to All Courses
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setExamCourseFilter('ALL');
                          setExamSubjectFilter('ALL');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                          examCourseFilter === 'ALL'
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>All Enrolled Courses</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            examCourseFilter === 'ALL'
                              ? 'bg-purple-800 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {examList.length}
                        </span>
                      </button>

                      {allAvailableCourses.map((cName) => {
                        const count = examList.filter((e) => e.course_name === cName).length;
                        const isSelected = examCourseFilter === cName;
                        return (
                          <button
                            key={cName}
                            type="button"
                            onClick={() => {
                              setExamCourseFilter(cName);
                              setExamSubjectFilter('ALL');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                              isSelected
                                ? 'bg-purple-700 text-white shadow-xs'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <BookOpen className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-purple-500'}`} />
                            <span>{cName}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isSelected
                                  ? 'bg-purple-800 text-white'
                                  : 'bg-purple-50 text-purple-700 border border-purple-100'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* KPI Cards (Dynamically reflects selected course) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="text-[11px] font-semibold text-slate-500">Total Evaluated</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{evaluatedTests.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {examCourseFilter !== 'ALL' ? `In selected course (${totalTestsInCourse} total)` : `Out of ${totalTests} scheduled`}
                    </p>
                  </div>

                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                    <p className="text-[11px] font-semibold text-emerald-700">Passed Tests</p>
                    <p className="text-lg font-bold text-emerald-800 mt-0.5">
                      {passedTests} <span className="text-xs font-normal text-emerald-600">({evaluatedTests.length > 0 ? Math.round((passedTests / evaluatedTests.length) * 100) : 0}%)</span>
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">{failedTests} failed • {absentTests} absent</p>
                  </div>

                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <p className="text-[11px] font-semibold text-indigo-700">Average Score</p>
                    <p className="text-lg font-bold text-indigo-800 mt-0.5">{avgPct}%</p>
                    <p className="text-[10px] text-indigo-600 mt-0.5">Institute benchmark: 50%</p>
                  </div>

                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                    <p className="text-[11px] font-semibold text-purple-700">Peak Performance</p>
                    <p className="text-lg font-bold text-purple-800 mt-0.5">{maxPct}%</p>
                    <p className="text-[10px] text-purple-600 mt-0.5">Highest score achieved</p>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-1">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search test, subject, code..."
                        value={examSearch}
                        onChange={(e) => setExamSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                      {examSearch && (
                        <button onClick={() => setExamSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {availableSubjects.length > 0 && (
                      <div className="w-full sm:w-44">
                        <select
                          value={examSubjectFilter}
                          onChange={(e) => setExamSubjectFilter(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-700 font-medium"
                        >
                          <option value="ALL">All Subjects ({courseExams.length})</option>
                          {availableSubjects.map((sName) => {
                            const subCount = courseExams.filter((e) => e.subject_name === sName).length;
                            return (
                              <option key={sName} value={sName}>
                                {sName} ({subCount})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
                    {[
                      { key: 'ALL', label: `All (${totalTestsInCourse})` },
                      { key: 'PASSED', label: `Passed (${passedTests})` },
                      { key: 'FAILED', label: `Failed (${failedTests})` },
                      { key: 'ABSENT', label: `Absent (${absentTests})` }
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={() => setExamStatusFilter(btn.key as any)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          examStatusFilter === btn.key
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Results Table */}
                {filteredExams.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
                    <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No Assessment Records Found</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
                      {totalTests === 0
                        ? 'No marks have been recorded for this student yet. Marks entered via Exams & Results will appear here.'
                        : examCourseFilter !== 'ALL' && totalTestsInCourse === 0
                          ? `No tests have been recorded yet for "${examCourseFilter}". Select another course or reset to All Courses.`
                          : 'No test records match your filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="py-2.5 px-4">Test / Examination</th>
                            <th className="py-2.5 px-4">Subject & Course</th>
                            <th className="py-2.5 px-4 text-center">Exam Date</th>
                            <th className="py-2.5 px-4 text-center">Marks (Score / Max)</th>
                            <th className="py-2.5 px-4 text-center">Percentage</th>
                            <th className="py-2.5 px-4 text-center">Grade</th>
                            <th className="py-2.5 px-4 text-center">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredExams.map((ex) => (
                            <tr key={ex.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{ex.exam_name}</div>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  {ex.exam_code && (
                                    <span className="font-mono text-[10px] text-purple-600 font-semibold">
                                      {ex.exam_code}
                                    </span>
                                  )}
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                      ex.is_published
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {ex.is_published ? 'Published' : 'Evaluated'}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800 flex items-center space-x-1">
                                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{ex.subject_name}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {ex.course_name || ex.class_name || 'Standard Curriculum'}
                                </div>
                              </td>

                              <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                                {ex.exam_date || '—'}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {ex.is_absent ? (
                                  <span className="text-slate-400 font-semibold font-mono">ABSENT</span>
                                ) : (
                                  <div>
                                    <span className="font-bold text-slate-900 text-sm font-mono">
                                      {ex.marks_obtained}
                                    </span>
                                    <span className="text-slate-400 font-mono text-xs"> / {ex.max_marks}</span>
                                    <div className="text-[10px] text-slate-400">Pass: {ex.passing_marks}</div>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {ex.is_absent ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <span className="font-bold text-slate-900 font-mono text-xs">
                                    {ex.percentage}%
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {ex.is_absent ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <span className="font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs">
                                    {ex.grade || '—'}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {ex.is_absent ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>ABSENT</span>
                                  </span>
                                ) : ex.is_pass ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                                    <span>PASSED</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>FAILED</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 10: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">KYC Documents & Verification</h4>
              <p className="text-slate-500">Student Aadhar, Previous Marksheets, and Photographs are archived securely.</p>
            </div>
          )}

          {/* TAB 11: ACTIVITY HISTORY */}
          {activeTab === 'history' && (
            <div className="text-xs space-y-4">
              <h4 className="font-bold text-slate-900 border-b pb-2">System Audit & Lifecycle Trail</h4>
              {activity_history.map((act: any, i: number) => (
                <div key={i} className="flex items-start space-x-3 text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">{act.action}</p>
                    <p className="text-slate-500">{act.description}</p>
                    <p className="text-[10px] text-slate-400">{act.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Student Modal */}
      {isEditModalOpen && (
        <EditStudentModal
          isOpen={isEditModalOpen}
          student={{ ...overview, id }}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updated) => {
            setFeedbackNotice({
              type: 'success',
              message: `Student "${updated.first_name} ${updated.last_name}" updated successfully.`
            });
            if (id) {
              api.get(`/students/${id}/profile`)
                .then((res) => setProfile(res.data))
                .catch((err) => console.error(err));
            }
            setTimeout(() => setFeedbackNotice(null), 4000);
          }}
        />
      )}

      {/* Convert Trial to Confirmed Admission Modal */}
      {showConvertTrialModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Confirm Full Admission (Convert Trial)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issue legal tuition invoice and finalize installment schedule for permanent admission.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConvertTrialModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {trialConvertError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{trialConvertError}</span>
              </div>
            )}

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
              <p>• <strong>Course:</strong> {primaryAcademic?.course_name || 'Academic Program'}</p>
              <p>• <strong>Form Fee Credited:</strong> ₹200 was already paid upfront on {overview.admission_date} (Receipt: <code>{overview.trial_receipt_number || 'REC-FORM-PAID'}</code>). It will NOT be charged again.</p>
              <p>• <strong>Installment Dates:</strong> Projected dynamically from student's actual joining date (<strong>{overview.admission_date}</strong>).</p>
            </div>

            <form onSubmit={handleConvertTrialSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Number of Installments *</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleConvertInstallmentCountChange(cnt)}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center ${
                        convertInstallments === cnt
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cnt} {cnt === 1 ? 'Lump-sum' : 'EMIs'}</span>
                      <span className="text-[9px] font-normal opacity-80 mt-0.5">
                        {cnt === 1 ? 'One-Time Rate' : 'EMI Rate'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {convertInstallments > 1 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Installment Due Dates (Anchored to Joining Date: {overview.admission_date})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {convertCustomInstallments.map((inst, idx) => (
                      <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 block text-[10px]">Inst #{inst.installment_number}</span>
                        <input
                          type="date"
                          value={inst.due_date}
                          onChange={(e) => {
                            const val = e.target.value;
                            setConvertCustomInstallments((prev) => {
                              const copy = [...prev];
                              copy[idx] = { ...copy[idx], due_date: val };
                              return copy;
                            });
                          }}
                          className="w-full text-xs p-1 border border-slate-300 rounded mt-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scholarship / Special Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={convertDiscount}
                  onChange={(e) => setConvertDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowConvertTrialModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={convertingTrial}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition"
                >
                  {convertingTrial ? 'Converting...' : 'Confirm Admission & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {isDeleteModalOpen && (
        <DeleteStudentModal
          isOpen={isDeleteModalOpen}
          student={{ ...overview, id }}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={() => {
            navigate('/students', { replace: true });
          }}
        />
      )}

      {/* Detailed Dual-Copy Invoice Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          isOpen={!!selectedInvoiceId}
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}

      {/* Official Payment Receipt Modal */}
      {selectedPaymentId && (
        <PaymentReceiptModal
          isOpen={!!selectedPaymentId}
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
        />
      )}

      {/* Official Student Admission Form / Dossier Modal */}
      {id && (
        <StudentAdmissionFormModal
          isOpen={isAdmissionFormOpen}
          studentId={id}
          onClose={() => setIsAdmissionFormOpen(false)}
        />
      )}

      {/* Enroll in Skill / Universal Course Modal */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Enroll in Skill / Universal Course
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add-on course offering independent of class grade. Issues a dedicated add-on invoice.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSkillModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {skillError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{skillError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmSkillEnrollment} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Skill Course *
                </label>
                <select
                  required
                  value={selectedSkillCourseId}
                  onChange={(e) => setSelectedSkillCourseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">-- Choose a Universal Course --</option>
                  {skillCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - {c.duration_months} Mos - Fee: ₹{Number(c.current_version?.base_fee || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSkillCourseId && (() => {
                const selCrs = skillCourses.find((c) => c.id === selectedSkillCourseId);
                const baseFee = Number(selCrs?.current_version?.base_fee || 0);
                const finalFee = Math.max(0, baseFee - Number(skillDiscount || 0));
                return (
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-purple-900 font-semibold">{selCrs?.name}</span>
                      <span className="font-extrabold text-purple-950">₹{baseFee.toLocaleString('en-IN')}</span>
                    </div>
                    {selCrs?.description && (
                      <p className="text-[11px] text-purple-700 line-clamp-2">{selCrs.description}</p>
                    )}
                    <div className="pt-1 flex justify-between text-[11px] text-purple-800 border-t border-purple-200/60">
                      <span>Course Duration: {selCrs?.duration_months} Months</span>
                      <span>Net Payable: <strong>₹{finalFee.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Teaching Batch (Optional)
                </label>
                <select
                  value={selectedSkillBatchId}
                  onChange={(e) => setSelectedSkillBatchId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">-- Auto-assign default active batch --</option>
                  {skillBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (Div {b.division || 'A'}) - Max {b.max_capacity} Seats
                    </option>
                  ))}
                </select>
              </div>

              {/* Billing Mode & Schedule / Live Simulation */}
              {(() => {
                const openInvs = (profile?.fees || []).filter((f: any) =>
                  ['ISSUED', 'PARTIALLY_PAID'].includes(f.status) &&
                  Number(f.balance_amount) > 0
                );
                const activeOpenInv = openInvs.find((inv: any) => inv.id === selectedTargetInvoiceId) || openInvs[0];
                const selCrs = skillCourses.find((c) => c.id === selectedSkillCourseId);
                const baseFee = Number(selCrs?.current_version?.base_fee || 0);
                const finalFee = Math.max(0, baseFee - Number(skillDiscount || 0));

                return (
                  <>
                    {/* Billing Mode Selector (Only when candidate open invoices exist) */}
                    {openInvs.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            Billing &amp; Invoice Mode *
                          </label>
                          <span className="text-[11px] text-slate-500">
                            {openInvs.length} Active Invoice{openInvs.length > 1 ? 's' : ''} with Open Balance
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Option 1: Separate Invoice */}
                          <div
                            onClick={() => setBillingMode('SEPARATE_INVOICE')}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                              billingMode === 'SEPARATE_INVOICE'
                                ? 'border-purple-600 bg-purple-50/60 ring-1 ring-purple-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                Separate Add-on Invoice
                              </span>
                              <input
                                type="radio"
                                name="billingMode"
                                checked={billingMode === 'SEPARATE_INVOICE'}
                                onChange={() => setBillingMode('SEPARATE_INVOICE')}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              Issues an independent bill with its own payment schedule &amp; receipts.
                            </p>
                          </div>

                          {/* Option 2: Merge into Existing Open Invoice */}
                          <div
                            onClick={() => {
                              setBillingMode('MERGE_INTO_OPEN_INVOICE');
                              if (!selectedTargetInvoiceId && activeOpenInv) {
                                setSelectedTargetInvoiceId(activeOpenInv.id);
                              }
                            }}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                              billingMode === 'MERGE_INTO_OPEN_INVOICE'
                                ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                Merge into Open Invoice
                              </span>
                              <input
                                type="radio"
                                name="billingMode"
                                checked={billingMode === 'MERGE_INTO_OPEN_INVOICE'}
                                onChange={() => {
                                  setBillingMode('MERGE_INTO_OPEN_INVOICE');
                                  if (!selectedTargetInvoiceId && activeOpenInv) {
                                    setSelectedTargetInvoiceId(activeOpenInv.id);
                                  }
                                }}
                                className="text-indigo-600 focus:ring-indigo-500"
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 leading-snug">
                              Adds line item to #{activeOpenInv?.invoice_number} and redistributes across remaining EMIs.
                            </p>
                          </div>
                        </div>

                        {/* If multiple open invoices, allow picking */}
                        {billingMode === 'MERGE_INTO_OPEN_INVOICE' && openInvs.length > 1 && (
                          <div className="pt-1">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Select Target Open Invoice:
                            </label>
                            <select
                              value={selectedTargetInvoiceId}
                              onChange={(e) => setSelectedTargetInvoiceId(e.target.value)}
                              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white text-xs"
                            >
                              {openInvs.map((inv: any) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.invoice_number} (Bal: ₹{Number(inv.balance_amount).toLocaleString('en-IN')}) - {inv.status}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Discount & Schedule / Simulation */}
                    <div className="space-y-3">
                      <div className={`grid ${billingMode === 'SEPARATE_INVOICE' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Special Scholarship / Discount (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={skillDiscount}
                            onChange={(e) => setSkillDiscount(Number(e.target.value))}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          />
                        </div>

                        {billingMode === 'SEPARATE_INVOICE' && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Payment Schedule (Installments)
                            </label>
                            <select
                              value={skillInstallments}
                              onChange={(e) => setSkillInstallments(Number(e.target.value))}
                              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                              <option value={1}>1 Full Payment (Single Invoice)</option>
                              <option value={2}>2 Monthly Installments (50% / 50%)</option>
                              <option value={3}>3 Monthly Installments</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Live Simulation Card when MERGE_INTO_OPEN_INVOICE is active */}
                      {billingMode === 'MERGE_INTO_OPEN_INVOICE' && activeOpenInv && selectedSkillCourseId && (() => {
                        const currentTotal = Number(activeOpenInv.total_amount || 0);
                        const currentBal = Number(activeOpenInv.balance_amount || 0);
                        const newTotal = currentTotal + finalFee;
                        const newBal = currentBal + finalFee;

                        const allInsts = activeOpenInv.installments || [];
                        const pendingInsts = allInsts.filter((i: any) => i.status === 'PENDING');
                        const targetList = pendingInsts.length > 0 ? pendingInsts : allInsts.filter((i: any) => i.status === 'PARTIALLY_PAID');
                        const count = targetList.length || 1;
                        const splitEach = Math.floor(finalFee / count);
                        const remainder = finalFee - (splitEach * count);

                        return (
                          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                              <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                                <span>🔄</span> Merged Invoice Simulation ({activeOpenInv.invoice_number})
                              </span>
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-full border border-indigo-200">
                                {count} Remaining EMI{count > 1 ? 's' : ''} Updated
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="bg-white/90 p-2 rounded-lg border border-indigo-100">
                                <span className="text-slate-500 block text-[10px]">Current Balance:</span>
                                <span className="font-bold text-slate-800 text-xs">₹{currentBal.toLocaleString('en-IN')}</span>
                                <span className="text-slate-400 block text-[10px]">Total Billed: ₹{currentTotal.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="bg-white/90 p-2 rounded-lg border border-indigo-100">
                                <span className="text-indigo-600 block font-semibold text-[10px]">New Balance Due:</span>
                                <span className="font-black text-indigo-950 text-xs">₹{newBal.toLocaleString('en-IN')}</span>
                                <span className="text-indigo-600 block text-[10px]">New Total: ₹{newTotal.toLocaleString('en-IN')}</span>
                              </div>
                            </div>

                            <div className="space-y-1 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">
                                Installment Schedule Breakdown:
                              </span>
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                {allInsts.map((inst: any, idx: number) => {
                                  const isPendingTarget = targetList.some((t: any) => t.id === inst.id);
                                  const targetIdx = targetList.findIndex((t: any) => t.id === inst.id);
                                  const addition = isPendingTarget ? (targetIdx === count - 1 ? splitEach + remainder : splitEach) : 0;
                                  const updatedAmt = Number(inst.amount) + addition;

                                  return (
                                    <div
                                      key={inst.id || idx}
                                      className={`p-2 rounded-lg flex items-center justify-between text-[11px] ${
                                        inst.status === 'PAID'
                                          ? 'bg-slate-100/80 border border-slate-200 text-slate-600'
                                          : 'bg-white border border-indigo-200 text-slate-800 shadow-2xs'
                                      }`}
                                    >
                                      <div>
                                        <span className="font-bold">Inst #{inst.installment_number}</span>
                                        <span className="text-slate-400 text-[10px] ml-1.5">Due: {inst.due_date}</span>
                                      </div>
                                      <div className="text-right">
                                        {inst.status === 'PAID' ? (
                                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-mono border border-emerald-200">
                                            ₹{Number(inst.amount).toLocaleString('en-IN')} [PAID - Unchanged]
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-1 font-mono">
                                            <span className="text-slate-400 line-through text-[10px]">₹{Number(inst.amount).toLocaleString('en-IN')}</span>
                                            <span className="font-extrabold text-indigo-950">
                                              ₹{updatedAmt.toLocaleString('en-IN')}
                                            </span>
                                            <span className="text-[10px] text-indigo-600 font-bold">(+₹{addition.toLocaleString('en-IN')})</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Modal Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => setShowSkillModal(false)}
                        className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={skillSubmitting || !selectedSkillCourseId}
                        className={`px-5 py-2 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 ${
                          billingMode === 'MERGE_INTO_OPEN_INVOICE'
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        {skillSubmitting ? (
                          <span>{billingMode === 'MERGE_INTO_OPEN_INVOICE' ? 'Merging Invoice...' : 'Issuing Invoice...'}</span>
                        ) : (
                          <>
                            <FileCheck className="w-4 h-4" />
                            <span>
                              {billingMode === 'MERGE_INTO_OPEN_INVOICE' && activeOpenInv
                                ? `Confirm & Merge into #${activeOpenInv.invoice_number}`
                                : 'Confirm & Issue Add-on Invoice'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
