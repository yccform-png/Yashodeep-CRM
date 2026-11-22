import React, { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import { useInstitute } from '../context/InstituteContext';

export const InstituteSettings: React.FC = () => {
  const { institute, updateInstitute } = useInstitute();
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

  // Keep form updated when institute data loads
  React.useEffect(() => {
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

  return (
    <div className="space-y-6">
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
    </div>
  );
};
export default InstituteSettings;
