import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Save,
  Loader2,
  MapPin,
  Landmark,
  ShieldCheck,
  Receipt,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Sparkles,
  Calendar,
  Users,
  UserPlus,
  Trash2,
  Share2,
  ToggleLeft,
  ToggleRight,
  Key,
  Check,
  ExternalLink,
  Shield,
  ShieldAlert,
  Phone,
  Mail,
  Lock,
  RefreshCw,
  AlertTriangle,
  X,
  Search,
  Copy,
  Eye,
  EyeOff,
  Edit3,
  KeyRound
} from 'lucide-react';
import { useInstitute } from '../context/InstituteContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { EditStaffModal } from '../components/EditStaffModal';
import { ResetStaffPasswordModal } from '../components/ResetStaffPasswordModal';

interface AdminUser {
  id: string;
  email: string;
  mobile: string;
  first_name: string;
  last_name: string;
  user_type: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  created_at?: string;
}

export const InstituteSettings: React.FC = () => {
  const { institute, updateInstitute } = useInstitute();
  const { user } = useAuth();
  const isSuperAdmin = user?.user_type === 'SUPER_ADMIN' || user?.roles?.includes('SUPER_ADMIN');

  // Active top tab
  const [activeTab, setActiveTab] = useState<'INSTITUTE' | 'ADMINS' | 'DANGER_ZONE'>('INSTITUTE');

  // Institute profile state
  const [savingInst, setSavingInst] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [instForm, setInstForm] = useState({
    name: institute?.name || '',
    tagline: institute?.tagline || '',
    address: institute?.address || '',
    contact_phone: institute?.contact_phone || '',
    secondary_phone: institute?.secondary_phone || '',
    contact_email: institute?.contact_email || '',
    website: institute?.website || '',
    gstin: institute?.gstin || '',
    registration_number: institute?.registration_number || '',
    bank_name: institute?.bank_name || '',
    bank_account_name: institute?.bank_account_name || '',
    bank_account_number: institute?.bank_account_number || '',
    bank_ifsc: institute?.bank_ifsc || '',
    bank_branch: institute?.bank_branch || '',
    upi_id: institute?.upi_id || '',
    signatory_title: institute?.signatory_title || 'Authorized Signatory',
    invoice_terms: institute?.invoice_terms || '',
    admission_form_fee: institute?.admission_form_fee !== undefined ? Number(institute.admission_form_fee) : 200,
    trial_period_days: institute?.trial_period_days !== undefined ? Number(institute.trial_period_days) : 14,
    grace_period_days: institute?.grace_period_days !== undefined ? Number(institute.grace_period_days) : 7,
    enable_admission_form_fee: institute?.enable_admission_form_fee ?? true,
    enable_trial_admission: institute?.enable_trial_admission ?? true,
  });

  // Admin management state
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'SUPER_ADMIN'>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newlyCreatedCreds, setNewlyCreatedCreds] = useState<{
    name: string;
    email: string;
    mobile: string;
    password: string;
  } | null>(null);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<AdminUser | null>(null);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false);
  const [selectedStaffForReset, setSelectedStaffForReset] = useState<AdminUser | null>(null);
  const [isResetStaffPasswordOpen, setIsResetStaffPasswordOpen] = useState(false);

  // Danger Zone / Go-Live Reset state
  interface DangerZonePreview {
    students_count: number;
    guardians_count: number;
    portal_users_count: number;
    invoices_count: number;
    total_gross_invoiced: number;
    payments_count: number;
    examinations_count: number;
    exam_marks_count: number;
    attendance_records_count: number;
    seat_allocations_count: number;
    bed_allocations_count: number;
  }
  const [dangerPreview, setDangerPreview] = useState<DangerZonePreview | null>(null);
  const [loadingDangerPreview, setLoadingDangerPreview] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgePassword, setPurgePassword] = useState('');
  const [showPurgePassword, setShowPurgePassword] = useState(false);
  const [purgeConfirmationPhrase, setPurgeConfirmationPhrase] = useState('');
  const [confirmCheck1, setConfirmCheck1] = useState(false);
  const [confirmCheck2, setConfirmCheck2] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const fetchDangerPreview = async () => {
    try {
      setLoadingDangerPreview(true);
      const res = await api.get<DangerZonePreview>('/institutes/danger-zone/preview');
      setDangerPreview(res.data);
    } catch (err: any) {
      console.error('Failed to load danger zone preview', err);
    } finally {
      setLoadingDangerPreview(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DANGER_ZONE' && isSuperAdmin) {
      fetchDangerPreview();
      setPurgeSuccess(null);
      setPurgeError(null);
    }
  }, [activeTab, isSuperAdmin]);

  const handleOpenPurgeModal = () => {
    setPurgePassword('');
    setPurgeConfirmationPhrase('');
    setConfirmCheck1(false);
    setConfirmCheck2(false);
    setPurgeError(null);
    setIsPurgeModalOpen(true);
  };

  const handleExecutePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmCheck1 || !confirmCheck2) {
      setPurgeError('Please acknowledge both safety checkboxes to proceed.');
      return;
    }
    if (purgeConfirmationPhrase.trim() !== 'CONFIRM-PURGE-TEST-DATA') {
      setPurgeError('Confirmation phrase does not match. Please type CONFIRM-PURGE-TEST-DATA exactly.');
      return;
    }
    if (!purgePassword) {
      setPurgeError('Please enter your Super Admin password to authorize the purge.');
      return;
    }

    try {
      setPurging(true);
      setPurgeError(null);
      const res = await api.post('/institutes/danger-zone/purge-test-data', {
        password: purgePassword,
        confirmation_phrase: purgeConfirmationPhrase.trim()
      });
      setIsPurgeModalOpen(false);
      setPurgeSuccess(res.data?.message || 'Test data successfully purged for production launch.');
      await fetchDangerPreview();
    } catch (err: any) {
      setPurgeError(err.response?.data?.detail || 'Failed to purge test data. Please verify your password.');
    } finally {
      setPurging(false);
    }
  };

  // Keep form updated when institute data loads
  useEffect(() => {
    if (institute) {
      setInstForm({
        name: institute.name || '',
        tagline: institute.tagline || '',
        address: institute.address || '',
        contact_phone: institute.contact_phone || '',
        secondary_phone: institute.secondary_phone || '',
        contact_email: institute.contact_email || '',
        website: institute.website || '',
        gstin: institute.gstin || '',
        registration_number: institute.registration_number || '',
        bank_name: institute.bank_name || '',
        bank_account_name: institute.bank_account_name || '',
        bank_account_number: institute.bank_account_number || '',
        bank_ifsc: institute.bank_ifsc || '',
        bank_branch: institute.bank_branch || '',
        upi_id: institute.upi_id || '',
        signatory_title: institute.signatory_title || 'Authorized Signatory',
        invoice_terms: institute.invoice_terms || '',
        admission_form_fee: institute.admission_form_fee !== undefined ? Number(institute.admission_form_fee) : 200,
        trial_period_days: institute.trial_period_days !== undefined ? Number(institute.trial_period_days) : 14,
        grace_period_days: institute.grace_period_days !== undefined ? Number(institute.grace_period_days) : 7,
        enable_admission_form_fee: institute.enable_admission_form_fee ?? true,
        enable_trial_admission: institute.enable_trial_admission ?? true,
      });
    }
  }, [institute]);

  // Load admins when switching to ADMINS tab
  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await api.get('/users?limit=200');
      // Filter only staff (SUPER_ADMIN and ADMIN), excluding STUDENT and PARENT
      const staff = res.data.filter((u: AdminUser) => u.user_type === 'SUPER_ADMIN' || u.user_type === 'ADMIN');
      setAdmins(staff);
    } catch (err: any) {
      setAdminFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to load staff accounts'
      });
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ADMINS' && isSuperAdmin) {
      fetchAdmins();
    }
  }, [activeTab, isSuperAdmin]);

  const handleSaveInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInst(true);
    setFeedback(null);
    try {
      await updateInstitute(instForm);
      setFeedback({
        type: 'success',
        text: 'Institute profile & letterhead updated successfully! Now dynamically reflected across all invoices, fee receipts, and printouts.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update institute profile.'
      });
    } finally {
      setSavingInst(false);
    }
  };

  const handleToggleStatus = async (admin: AdminUser) => {
    setTogglingUserId(admin.id);
    try {
      const newStatus = !admin.is_active;
      await api.patch(`/users/${admin.id}/status?is_active=${newStatus}`);
      setAdmins((prev) => prev.map((u) => (u.id === admin.id ? { ...u, is_active: newStatus } : u)));
      setAdminFeedback({
        type: 'success',
        text: `Account for ${admin.first_name} ${admin.last_name} has been ${newStatus ? 'activated' : 'deactivated'}.`
      });
    } catch (err: any) {
      setAdminFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update account status.'
      });
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDeleteAdmin = async (admin: AdminUser) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete the admin account for ${admin.first_name} ${admin.last_name}? This action cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingUserId(admin.id);
    try {
      await api.delete(`/users/${admin.id}`);
      setAdmins((prev) => prev.filter((u) => u.id !== admin.id));
      setAdminFeedback({
        type: 'success',
        text: `Admin account for ${admin.first_name} ${admin.last_name} was deleted successfully.`
      });
    } catch (err: any) {
      setAdminFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to delete account.'
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'Ycc@';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAdmin((prev) => ({ ...prev, password: pass }));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdmin(true);
    setAdminFeedback(null);
    try {
      const payload = {
        first_name: newAdmin.first_name.trim(),
        last_name: newAdmin.last_name.trim(),
        email: newAdmin.email.trim().toLowerCase(),
        mobile: newAdmin.mobile.trim(),
        password: newAdmin.password,
        user_type: 'ADMIN',
        role_codes: ['ADMIN'],
      };
      const res = await api.post('/users', payload);
      const created: AdminUser = res.data;
      setAdmins((prev) => [created, ...prev]);
      setNewlyCreatedCreds({
        name: `${payload.first_name} ${payload.last_name}`,
        email: payload.email,
        mobile: payload.mobile,
        password: payload.password,
      });
      setIsCreateOpen(false);
      setNewAdmin({ first_name: '', last_name: '', email: '', mobile: '', password: '' });
      setAdminFeedback({
        type: 'success',
        text: `Admin account for ${payload.first_name} ${payload.last_name} created successfully! You can share their login credentials below.`,
      });
    } catch (err: any) {
      setAdminFeedback({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to create admin account. Please verify email and mobile uniqueness.',
      });
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const shareViaWhatsApp = (name: string, mobile: string, email: string, tempPassword?: string) => {
    const cleanMobile = mobile ? mobile.replace(/\D/g, '') : '';
    const loginUrl = `${window.location.origin}/login`;
    let text = `*Yashodeep Coaching Classes - Staff Portal Login*\n\n`;
    text += `Hello *${name}*,\nYour Administrator account has been provisioned on the Yashodeep Coaching ERP portal.\n\n`;
    text += `🌐 *Portal URL:* ${loginUrl}\n`;
    text += `👤 *Username / Mobile:* ${mobile || email}\n`;
    if (tempPassword) {
      text += `🔑 *Temporary Password:* \`${tempPassword}\`\n`;
    } else {
      text += `🔑 *Password:* (Use your assigned staff password)\n`;
    }
    text += `\n*Operational Scope:*\n`;
    text += `• Student Admissions & Dossiers\n`;
    text += `• Batches & Timetables\n`;
    text += `• Daily Attendance Marking\n`;
    text += `• Exams, Marks & Report Cards\n`;
    text += `• Hostel & Study Room Accommodations\n\n`;
    text += `_Please sign in and change your password. Do not share your login credentials._`;

    const target = cleanMobile.length >= 10
      ? `https://wa.me/91${cleanMobile.slice(-10)}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(target, '_blank');
  };

  const copyCredentials = (name: string, mobile: string, email: string, tempPassword?: string, idKey?: string) => {
    let text = `Yashodeep Coaching Classes - Staff Login\nName: ${name}\nPortal: ${window.location.origin}/login\nUser/Mobile: ${mobile || email}\n`;
    if (tempPassword) text += `Password: ${tempPassword}\n`;
    navigator.clipboard.writeText(text);
    setCopiedId(idKey || 'NEW');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      const matchRole = filterRole === 'ALL' || a.user_type === filterRole;
      const term = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        a.first_name.toLowerCase().includes(term) ||
        a.last_name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        (a.mobile && a.mobile.includes(term));
      return matchRole && matchSearch;
    });
  }, [admins, filterRole, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Tab Bar (Visible if user is SUPER_ADMIN) */}
      {isSuperAdmin && (
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('INSTITUTE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'INSTITUTE'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Institute Profile &amp; Letterhead</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ADMINS')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ADMINS'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff &amp; Admin Accounts</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'ADMINS' ? 'bg-indigo-400/30 text-white' : 'bg-indigo-100 text-indigo-700'
            }`}>
              Super Admin
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DANGER_ZONE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'DANGER_ZONE'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'bg-white text-slate-600 hover:text-rose-700 border border-slate-200 hover:bg-rose-50/50'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'DANGER_ZONE' ? 'text-white' : 'text-rose-500'}`} />
            <span>Danger Zone / Go-Live Reset</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
              activeTab === 'DANGER_ZONE' ? 'bg-rose-400/30 text-white' : 'bg-rose-100 text-rose-700'
            }`}>
              Reset
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: INSTITUTE PROFILE & LETTERHEAD */}
      {/* ========================================================================= */}
      {activeTab === 'INSTITUTE' && (
        <>
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/80 p-4 sm:p-5 rounded-2xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Institute Identity, Letterhead &amp; Billing Profile</h3>
              </div>
              <p className="text-xs text-slate-600 max-w-3xl">
                Configure your coaching institute name, registration number, campus address, helpline contacts, and payment coordinates.
                These details dynamically brand your printed <strong>Dual-Copy Invoices</strong>, <strong>Official Payment Receipts</strong>, and student dossiers.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveInstitute}
              disabled={savingInst}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 shrink-0 self-start md:self-auto cursor-pointer"
            >
              {savingInst ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Institute Profile</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Column - Spans 2 cols */}
            <form onSubmit={handleSaveInstitute} className="lg:col-span-2 space-y-6">
              {/* Card 1: Branding & Recognition */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Building className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Institution Branding &amp; Recognition</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Coaching Class / Institute Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={instForm.name}
                      onChange={(e) => setInstForm({ ...instForm, name: e.target.value })}
                      placeholder="e.g. Yashodeep Coaching Classes / YCC Institute"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-slate-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Academic Tagline / Slogan</label>
                    <input
                      type="text"
                      value={instForm.tagline}
                      onChange={(e) => setInstForm({ ...instForm, tagline: e.target.value })}
                      placeholder="e.g. Excellence in Science, Commerce &amp; Competitive Exam Coaching"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Government / Trust Registration No.</label>
                    <input
                      type="text"
                      value={instForm.registration_number}
                      onChange={(e) => setInstForm({ ...instForm, registration_number: e.target.value })}
                      placeholder="e.g. REG/MH/PUN/2024/0981"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">GSTIN / Tax ID (Optional)</label>
                    <input
                      type="text"
                      value={instForm.gstin}
                      onChange={(e) => setInstForm({ ...instForm, gstin: e.target.value })}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Campus Address & Official Communication */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Campus Address &amp; Contact Details</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Campus / Branch Address <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={instForm.address}
                      onChange={(e) => setInstForm({ ...instForm, address: e.target.value })}
                      placeholder="Campus Building, Street, Landmark, Area, City, State, PIN"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Primary Helpline Phone *</label>
                    <input
                      type="text"
                      required
                      value={instForm.contact_phone}
                      onChange={(e) => setInstForm({ ...instForm, contact_phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Secondary / Accounts Phone</label>
                    <input
                      type="text"
                      value={instForm.secondary_phone}
                      onChange={(e) => setInstForm({ ...instForm, secondary_phone: e.target.value })}
                      placeholder="+91 98765 43211"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Accounts / Admin Email</label>
                    <input
                      type="email"
                      value={instForm.contact_email}
                      onChange={(e) => setInstForm({ ...instForm, contact_email: e.target.value })}
                      placeholder="info@yashodeepcoachingclasses.in"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Website Address</label>
                    <input
                      type="text"
                      value={instForm.website}
                      onChange={(e) => setInstForm({ ...instForm, website: e.target.value })}
                      placeholder="www.yashodeepcoachingclasses.in"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Fee Payment Instructions & Bank/UPI Coordinates */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Landmark className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Bank &amp; UPI Payment Coordinates (Printed on Invoices)</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      value={instForm.bank_name}
                      onChange={(e) => setInstForm({ ...instForm, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank / State Bank of India"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Beneficiary Name</label>
                    <input
                      type="text"
                      value={instForm.bank_account_name}
                      onChange={(e) => setInstForm({ ...instForm, bank_account_name: e.target.value })}
                      placeholder="e.g. Yashodeep Coaching Classes Educational Trust"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Account Number</label>
                    <input
                      type="text"
                      value={instForm.bank_account_number}
                      onChange={(e) => setInstForm({ ...instForm, bank_account_number: e.target.value })}
                      placeholder="e.g. 50100234567890"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">IFSC Code</label>
                    <input
                      type="text"
                      value={instForm.bank_ifsc}
                      onChange={(e) => setInstForm({ ...instForm, bank_ifsc: e.target.value })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank Branch Location</label>
                    <input
                      type="text"
                      value={instForm.bank_branch}
                      onChange={(e) => setInstForm({ ...instForm, bank_branch: e.target.value })}
                      placeholder="e.g. Kuditre / Kolhapur Branch"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official UPI ID / VPA</label>
                    <input
                      type="text"
                      value={instForm.upi_id}
                      onChange={(e) => setInstForm({ ...instForm, upi_id: e.target.value })}
                      placeholder="e.g. ycc@hdfcbank"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-emerald-700 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Admission Form Fee & Trial Period Configuration */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Admission Form Fee &amp; Trial Period Settings</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Super Admin Only
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Form Fee Settings */}
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-950">One-time Form / Prospectus Fee</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={instForm.enable_admission_form_fee}
                          onChange={(e) => setInstForm({ ...instForm, enable_admission_form_fee: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Non-refundable upfront charge taken from new students before trial or during admission.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Form Fee Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        disabled={!instForm.enable_admission_form_fee}
                        value={instForm.admission_form_fee}
                        onChange={(e) => setInstForm({ ...instForm, admission_form_fee: Number(e.target.value) })}
                        placeholder="200"
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-900 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Trial Period Settings */}
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950">Provisional Trial Lectures Mode</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={instForm.enable_trial_admission}
                          onChange={(e) => setInstForm({ ...instForm, enable_trial_admission: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    <p className="text-[11px] text-indigo-700">
                      Allows students to attend classes for 1–2 weeks before paying full course tuition.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trial Period Duration (Days)</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          disabled={!instForm.enable_trial_admission}
                          value={instForm.trial_period_days}
                          onChange={(e) => setInstForm({ ...instForm, trial_period_days: Number(e.target.value) })}
                          placeholder="14"
                          className="w-24 text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-900 disabled:opacity-50"
                        />
                        <div className="flex items-center space-x-1">
                          {[7, 10, 14, 21].map((days) => (
                            <button
                              key={days}
                              type="button"
                              disabled={!instForm.enable_trial_admission}
                              onClick={() => setInstForm({ ...instForm, trial_period_days: days })}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                                instForm.trial_period_days === days
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              } disabled:opacity-40`}
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grace Period & Installment Settings */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Monthly Installment (EMI) Grace Period</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Days past the monthly joining date before an installment turns OVERDUE.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={instForm.grace_period_days}
                      onChange={(e) => setInstForm({ ...instForm, grace_period_days: Number(e.target.value) })}
                      className="w-20 text-xs p-2 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-900"
                    />
                    <span className="text-xs font-semibold text-slate-500">Days Grace</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Signatory & Invoice Policy Terms */}
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">5. Signatory &amp; Invoice Policy Terms</h4>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authorized Signatory Title</label>
                    <input
                      type="text"
                      value={instForm.signatory_title}
                      onChange={(e) => setInstForm({ ...instForm, signatory_title: e.target.value })}
                      placeholder="e.g. Authorized Signatory / Accounts Officer"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Official Terms &amp; Conditions / Receipt Note</label>
                    <textarea
                      rows={3}
                      value={instForm.invoice_terms}
                      onChange={(e) => setInstForm({ ...instForm, invoice_terms: e.target.value })}
                      placeholder="1. Fees once paid are subject to institutional policies...&#10;2. Please retain this receipt for audit..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingInst}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingInst ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Institute Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Right Column: Live Letterhead & Voucher Preview */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 sticky top-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Letterhead Preview</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    A4 Dynamic Print
                  </span>
                </div>

                {/* Visual Letterhead Header Box */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-center text-xs">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold text-base shadow-sm">
                    {instForm.name ? instForm.name[0] : 'Y'}
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">{instForm.name || 'Yashodeep Coaching Classes'}</h3>
                  {instForm.tagline && (
                    <p className="text-[11px] font-semibold text-emerald-700 italic">{instForm.tagline}</p>
                  )}
                  <p className="text-[11px] text-slate-600">{instForm.address || 'Yashodeep Campus, Kuditre, Karveer, Kolhapur'}</p>
                  <div className="flex items-center justify-center flex-wrap gap-x-3 text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200">
                    {instForm.registration_number && <span>Reg: {instForm.registration_number}</span>}
                    {instForm.gstin && <span>GST: {instForm.gstin}</span>}
                    <span>Phone: {instForm.contact_phone || '—'}</span>
                  </div>
                </div>

                {/* Sample Snippet */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 space-y-1">
                  <p className="font-bold">✓ Dual-Copy Synchronized</p>
                  <p className="text-slate-600 text-[11px]">
                    This dynamic header will appear identically on both the <strong>Student Copy</strong> and <strong>Office Copy</strong> of every A4 printout.
                  </p>
                </div>

                {/* Bank Snippet Preview */}
                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 text-[11px] space-y-1 text-slate-700">
                  <p className="font-bold text-purple-900 text-[10px] uppercase tracking-wider">Fee Payment Instructions</p>
                  <p className="text-[11px]"><strong className="text-slate-900">Bank:</strong> {instForm.bank_name || 'HDFC Bank'}</p>
                  <p className="text-[11px] font-mono"><strong className="text-slate-900">A/C:</strong> {instForm.bank_account_number || '—'} ({instForm.bank_ifsc || '—'})</p>
                  <p className="text-[11px] font-mono text-emerald-700"><strong className="text-slate-900">UPI VPA:</strong> {instForm.upi_id || '—'}</p>
                </div>

                {/* Signatory Preview */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Authorized Signature:</span>
                  <span className="font-bold text-slate-800">{instForm.signatory_title || 'Authorized Signatory'}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STAFF & ADMIN ACCOUNTS (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'ADMINS' && isSuperAdmin && (
        <div className="space-y-6">
          {/* Admin Action Feedback Banner */}
          {adminFeedback && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in ${
                adminFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                {adminFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{adminFeedback.text}</span>
              </div>
              <button
                onClick={() => setAdminFeedback(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* Newly Created Credentials Modal / Callout */}
          {newlyCreatedCreds && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                    <Check className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Admin Account Provisioned &amp; Ready to Share
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setNewlyCreatedCreds(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white/80 p-3 rounded-xl border border-emerald-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Admin Name</span>
                  <span className="font-bold text-slate-800">{newlyCreatedCreds.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Login Mobile / Email</span>
                  <span className="font-mono font-bold text-slate-800">{newlyCreatedCreds.mobile || newlyCreatedCreds.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Password</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                    {newlyCreatedCreds.password}
                  </span>
                </div>
                <div className="flex items-center space-x-2 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() =>
                      shareViaWhatsApp(
                        newlyCreatedCreds.name,
                        newlyCreatedCreds.mobile,
                        newlyCreatedCreds.email,
                        newlyCreatedCreds.password
                      )
                    }
                    className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      copyCredentials(
                        newlyCreatedCreds.name,
                        newlyCreatedCreds.mobile,
                        newlyCreatedCreds.email,
                        newlyCreatedCreds.password,
                        'NEW'
                      )
                    }
                    className="inline-flex items-center justify-center p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                    title="Copy Credentials"
                  >
                    {copiedId === 'NEW' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-purple-50/80 p-4 sm:p-5 rounded-2xl border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Unified Staff &amp; Administrator Management</h3>
              </div>
              <p className="text-xs text-slate-600 max-w-3xl">
                In this streamlined 4-role model, <strong>Admins</strong> manage all everyday campus operations:
                Admissions, Academic Batches, Daily Attendance, Exams &amp; Marks, Hostel, and Study Room allocation.
                <strong className="text-indigo-950"> Super Admin</strong> retains exclusive authority over Fee collection, receipts, and financial ledgers.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition shrink-0 self-start md:self-auto cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Admin</span>
            </button>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Staff Accounts</span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{admins.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Super Admins &amp; Operations Admins</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Active Admins</span>
              <p className="text-xl font-extrabold text-emerald-700 mt-1">
                {admins.filter((a) => a.is_active && a.user_type === 'ADMIN').length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Authorized for campus management</p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Admin Operational Scope</span>
              <p className="text-xs font-bold text-indigo-950 mt-1.5 flex flex-wrap gap-1">
                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Admissions</span>
                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Batches</span>
                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Attendance</span>
                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Exams</span>
                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px]">Hostel</span>
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Financial Security</span>
              <p className="text-xs font-bold text-amber-950 mt-1.5 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Super Admin Locked</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Fee collections &amp; Ledgers shielded</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search staff by name, email, or mobile..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterRole('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterRole === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Staff ({admins.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('ADMIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterRole === 'ADMIN'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                Admins ({admins.filter((a) => a.user_type === 'ADMIN').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRole('SUPER_ADMIN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterRole === 'SUPER_ADMIN'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Super Admin ({admins.filter((a) => a.user_type === 'SUPER_ADMIN').length})
              </button>
              <button
                type="button"
                onClick={fetchAdmins}
                disabled={loadingAdmins}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Refresh accounts"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAdmins ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Admins Table / List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingAdmins ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-semibold">Loading staff accounts...</p>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No staff accounts found</p>
                <p className="text-[11px] text-slate-400">Click "+ Add New Admin" above to provision an administrator profile.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role &amp; Security Scope</th>
                      <th className="py-3 px-4">Contact Information</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAdmins.map((admin) => {
                      const isMasterSuperAdmin = admin.user_type === 'SUPER_ADMIN';
                      const isCurrentUser = admin.id === user?.id;

                      return (
                        <tr key={admin.id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isMasterSuperAdmin
                                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xs'
                                    : 'bg-gradient-to-tr from-blue-500 to-cyan-500 text-white shadow-xs'
                                }`}
                              >
                                {admin.first_name ? admin.first_name[0] : 'U'}
                                {admin.last_name ? admin.last_name[0] : ''}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                  <span>
                                    {admin.first_name} {admin.last_name}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">ID: {admin.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div>
                                {isMasterSuperAdmin ? (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                    <Shield className="w-3 h-3 text-purple-600" />
                                    <span>Master Super Admin</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                                    <ShieldCheck className="w-3 h-3 text-blue-600" />
                                    <span>Operations Admin</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500">
                                {isMasterSuperAdmin ? (
                                  <span className="text-purple-700 font-semibold">
                                    Full Financial, Fee Billing &amp; Campus Control
                                  </span>
                                ) : (
                                  <span className="text-slate-600">
                                    Admissions • Batches • Attendance • Exams • Hostel
                                  </span>
                                )}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-1.5 text-[11px]">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{admin.email}</span>
                              </div>
                              <div className="flex items-center space-x-1.5 text-[11px]">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{admin.mobile || '—'}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {admin.is_active ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                <span>Deactivated</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center space-x-1">
                              {/* WhatsApp Invite Button */}
                              {admin.mobile && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    shareViaWhatsApp(
                                      `${admin.first_name} ${admin.last_name}`,
                                      admin.mobile,
                                      admin.email
                                    )
                                  }
                                  className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                  title="Share Login Details via WhatsApp"
                                >
                                  <Share2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Copy Credentials */}
                              <button
                                type="button"
                                onClick={() =>
                                  copyCredentials(
                                    `${admin.first_name} ${admin.last_name}`,
                                    admin.mobile,
                                    admin.email,
                                    undefined,
                                    admin.id
                                  )
                                }
                                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Copy Login Info"
                              >
                                {copiedId === admin.id ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>

                              {/* Edit Staff Profile (Super Admin or Self) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStaffForEdit(admin);
                                  setIsEditStaffOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title={isMasterSuperAdmin ? 'Edit Super Admin Profile (Self)' : 'Edit Staff Admin Profile'}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              {/* Reset Admin Password (Only for Operational Admins) */}
                              {!isMasterSuperAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStaffForReset(admin);
                                    setIsResetStaffPasswordOpen(true);
                                  }}
                                  className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="Reset Staff Admin Password"
                                >
                                  <KeyRound className="w-4 h-4" />
                                </button>
                              )}

                              {/* Toggle Active Status */}
                              {!isMasterSuperAdmin && !isCurrentUser && (
                                <button
                                  type="button"
                                  disabled={togglingUserId === admin.id}
                                  onClick={() => handleToggleStatus(admin)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    admin.is_active
                                      ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={admin.is_active ? 'Deactivate Account' : 'Activate Account'}
                                >
                                  {togglingUserId === admin.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                  ) : admin.is_active ? (
                                    <ToggleRight className="w-4 h-4" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4" />
                                  )}
                                </button>
                              )}

                              {/* Delete Admin Button */}
                              {!isMasterSuperAdmin && !isCurrentUser && (
                                <button
                                  type="button"
                                  disabled={deletingUserId === admin.id}
                                  onClick={() => handleDeleteAdmin(admin)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete Admin Account"
                                >
                                  {deletingUserId === admin.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
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
            )}
          </div>

          {/* Explanatory Policy Callout */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900">How the 4-Role Unified Architecture Works</p>
              <p className="text-[11px] leading-relaxed">
                Admins log in via the <strong>[ Staff &amp; Admin ]</strong> tab at <code>/login</code> using either their registered email or 10-digit mobile number.
                They have autonomous control over student registrations, attendance, lectures, exams, hostel beds, and study desks.
                However, every fee-collection API endpoint, invoice printing gateway, payment registration, and balance ledger strictly enforces <code>require_role(["SUPER_ADMIN"])</code>, ensuring complete financial security.
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CREATE ADMIN MODAL */}
          {/* ========================================================================= */}
          {isCreateOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Create Operational Admin Profile</h3>
                      <p className="text-[11px] text-slate-500">Grants campus management access without financial rights</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        First Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newAdmin.first_name}
                        onChange={(e) => setNewAdmin({ ...newAdmin, first_name: e.target.value })}
                        placeholder="e.g. Pooja"
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Last Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newAdmin.last_name}
                        onChange={(e) => setNewAdmin({ ...newAdmin, last_name: e.target.value })}
                        placeholder="e.g. Deshmukh"
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Official Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      placeholder="e.g. pooja.deshmukh@yashodeep.in"
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      10-Digit Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        pattern="[0-9]{10}"
                        value={newAdmin.mobile}
                        onChange={(e) => setNewAdmin({ ...newAdmin, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        placeholder="9876543210"
                        className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Used for direct SMS/WhatsApp notifications and portal login.</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Login Password <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Auto-Generate</span>
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newAdmin.password}
                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full pr-10 pl-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Scope summary callout in modal */}
                  <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                    <p className="font-bold flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Role: Operational Administrator</span>
                    </p>
                    <p className="text-slate-600 text-[10.5px]">
                      This user will have full access to Students, Admissions, Batches, Attendance, Exams, Hostel &amp; Study Rooms.
                      <strong> Invoices, Fee collections, and Financial metrics remain strictly locked to Super Admin.</strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingAdmin}
                      className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      {submittingAdmin ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Profile...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Create Admin Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Staff Modal */}
          {isEditStaffOpen && selectedStaffForEdit && (
            <EditStaffModal
              isOpen={isEditStaffOpen}
              staff={selectedStaffForEdit}
              onClose={() => {
                setIsEditStaffOpen(false);
                setSelectedStaffForEdit(null);
              }}
              onSuccess={(updatedUser) => {
                setAdmins((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
                setAdminFeedback({
                  type: 'success',
                  text: `Successfully updated profile for ${updatedUser.first_name} ${updatedUser.last_name}`
                });
              }}
            />
          )}

          {/* Reset Staff Password Modal */}
          {isResetStaffPasswordOpen && selectedStaffForReset && (
            <ResetStaffPasswordModal
              isOpen={isResetStaffPasswordOpen}
              staff={selectedStaffForReset}
              onClose={() => {
                setIsResetStaffPasswordOpen(false);
                setSelectedStaffForReset(null);
              }}
              onSuccess={() => {
                setAdminFeedback({
                  type: 'success',
                  text: `Password reset successfully for ${selectedStaffForReset.first_name}`
                });
              }}
            />
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DANGER ZONE & PRODUCTION GO-LIVE RESET (SUPER ADMIN ONLY) */}
      {/* ========================================================================= */}
      {activeTab === 'DANGER_ZONE' && isSuperAdmin && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Purge Success Banner */}
          {purgeSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-semibold shadow-xs">
              <div className="flex items-center space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{purgeSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setPurgeSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Purge Error Banner */}
          {purgeError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900 font-semibold shadow-xs">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{purgeError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPurgeError(null)}
                className="text-rose-700 hover:text-rose-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Warning Top Card */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-950 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm shadow-rose-600/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-950">
                    Production Go-Live Data Purge &amp; Reset
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    This utility is built for the Super Administrator to clear all testing data (test students, mock invoices, payment receipts, test examination papers, and attendance logs) created during testing before admitting real students in production.
                  </p>
                  <div className="mt-3 flex items-center space-x-2 text-xs font-semibold text-rose-900 bg-rose-100/70 py-1.5 px-3 rounded-lg border border-rose-200 inline-flex">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>All master configurations (Branding, Academic Years, Classes, Courses, Batches, Study Room Desks, Hostel Rooms, and Staff Logins) remain 100% intact.</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchDangerPreview}
                disabled={loadingDangerPreview}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold transition shrink-0 self-start cursor-pointer"
                title="Reload live record counts"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDangerPreview ? 'animate-spin' : ''}`} />
                <span>Refresh Counts</span>
              </button>
            </div>
          </div>

          {/* Live Inventory Footprint Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Test Students</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {loadingDangerPreview ? '...' : (dangerPreview?.students_count || 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                + {dangerPreview?.portal_users_count || 0} student/parent portal logins
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Gross Invoiced</span>
                <Receipt className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {loadingDangerPreview ? '...' : `₹${Number(dangerPreview?.total_gross_invoiced || 0).toLocaleString('en-IN')}`}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Across {dangerPreview?.invoices_count || 0} invoices &amp; {dangerPreview?.payments_count || 0} payments
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Exams &amp; Results</span>
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {loadingDangerPreview ? '...' : (dangerPreview?.examinations_count || 0)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                With {dangerPreview?.exam_marks_count || 0} marks entered
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Facility Tenancies</span>
                <Building className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">
                {loadingDangerPreview ? '...' : ((dangerPreview?.seat_allocations_count || 0) + (dangerPreview?.bed_allocations_count || 0))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {dangerPreview?.seat_allocations_count || 0} desks, {dangerPreview?.bed_allocations_count || 0} beds booked
              </p>
            </div>
          </div>

          {/* Side-by-Side Scope Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Will Be Deleted */}
            <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm pb-3 border-b border-rose-100">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Records That Will Be Permanently Purged</span>
              </div>
              <ul className="mt-3.5 space-y-2 text-xs text-slate-700">
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Student Registry:</strong> All student profiles, admission numbers, uploaded documents, and emergency contacts.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Portal Credentials:</strong> Student and Parent portal accounts (removes unauthorized logins).</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Finance &amp; Invoices:</strong> All invoices, payment receipts, installment schedules, and fee discounts.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Tests &amp; Marks:</strong> Created test papers, paper subjects, student marks, and report cards.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Attendance:</strong> Daily attendance rosters and batch session records.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0 mt-0.5">✕</span>
                  <span><strong>Facility Occupancies:</strong> Study room seat allocations and hostel bed bookings (resets statuses to Available).</span>
                </li>
              </ul>
            </div>

            {/* Will Remain Intact */}
            <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm pb-3 border-b border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Master Infrastructure Kept 100% Intact</span>
              </div>
              <ul className="mt-3.5 space-y-2 text-xs text-slate-700">
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Institute Profile:</strong> Institute branding, logo, GSTIN, campus address, and bank/UPI coordinates.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Staff Accounts:</strong> SuperAdmin, Admin, Teacher, and Accountant user logins and permissions.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Academic Structure:</strong> Academic Sessions (2026-2027, 2027-2028), Classes (5th to 12th), Streams, and Subjects.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Batches &amp; Divisions:</strong> Configured division classrooms (e.g. 10th - Div A) stay ready for real admissions.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Facility Layout:</strong> All 150 Study Room desks and Hostel rooms/beds (ready for clean occupancy).</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0 mt-0.5">✓</span>
                  <span><strong>Auto-Sequence Reset:</strong> Invoice numbers (<code>INV-YYYY-00001</code>) and student PRNs start fresh at <code>0001</code>.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Trigger Action Box */}
          <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Ready to prepare Yashodeep ERP for real admissions?
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Once confirmed, all test transactional data is deleted immediately in a single atomic transaction.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenPurgeModal}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition cursor-pointer shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Purge Test Data &amp; Reset for Production</span>
            </button>
          </div>

          {/* Triple-Lock Confirmation Modal */}
          {isPurgeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-lg w-full p-6 animate-in zoom-in-95 overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-rose-600">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <h3 className="text-base font-bold text-slate-900">
                      Permanently Purge Test Data
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPurgeModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleExecutePurge} className="mt-4 space-y-4">
                  {purgeError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{purgeError}</span>
                    </div>
                  )}

                  <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
                    <strong>Warning:</strong> This operation is <strong>irreversible</strong>. All test student records, invoices, receipts, and exam marks will be permanently removed.
                  </div>

                  {/* Lock 1: Mandatory Checkboxes */}
                  <div className="space-y-2.5 pt-1">
                    <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={confirmCheck1}
                        onChange={(e) => setConfirmCheck1(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>I confirm that I want to wipe all student profiles, invoices, installments, receipts, and exam papers.</span>
                    </label>

                    <label className="flex items-start space-x-2.5 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={confirmCheck2}
                        onChange={(e) => setConfirmCheck2(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>I understand that batch divisions, courses, classes, study room desks, and staff accounts will remain intact.</span>
                    </label>
                  </div>

                  {/* Lock 2: Confirmation Phrase */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Type <span className="font-mono text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">CONFIRM-PURGE-TEST-DATA</span> to proceed:
                    </label>
                    <input
                      type="text"
                      value={purgeConfirmationPhrase}
                      onChange={(e) => setPurgeConfirmationPhrase(e.target.value)}
                      placeholder="CONFIRM-PURGE-TEST-DATA"
                      className="w-full text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Lock 3: Super Admin Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Enter Super Admin Password:
                    </label>
                    <div className="relative">
                      <input
                        type={showPurgePassword ? 'text' : 'password'}
                        value={purgePassword}
                        onChange={(e) => setPurgePassword(e.target.value)}
                        placeholder="Your Super Admin password"
                        className="w-full text-xs px-3 py-2 pr-9 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPurgePassword(!showPurgePassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      >
                        {showPurgePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsPurgeModalOpen(false)}
                      disabled={purging}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        purging ||
                        !confirmCheck1 ||
                        !confirmCheck2 ||
                        purgeConfirmationPhrase.trim() !== 'CONFIRM-PURGE-TEST-DATA' ||
                        !purgePassword
                      }
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
                    >
                      {purging ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Purging Test Data...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Permanently Purge Data</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstituteSettings;
