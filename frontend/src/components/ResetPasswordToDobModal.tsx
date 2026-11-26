import React, { useState } from 'react';
import { KeyRound, X, Loader2, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import api from '../api/client';

interface ResetPasswordToDobModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null;
  onSuccess?: (result: any) => void;
}

export const ResetPasswordToDobModal: React.FC<ResetPasswordToDobModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess
}) => {
  const [target, setTarget] = useState<'BOTH' | 'STUDENT' | 'PARENT'>('BOTH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);

  if (!isOpen || !student) return null;

  const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
  const prn = student.prn || (student.student_code ? student.student_code.replace('STU-', 'PRN-') : student.id);
  
  // Compute display DOB if available
  let dobFormatted = '';
  let dobPasswordPreview = '';
  if (student.date_of_birth) {
    const parts = student.date_of_birth.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> DDMMYYYY
      dobPasswordPreview = `${parts[2]}${parts[1]}${parts[0]}`;
      dobFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const handleReset = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/students/${student.id}/reset-password-to-dob`, { target });
      setResult(res.data);
      if (onSuccess) onSuccess(res.data);
    } catch (err: any) {
      console.error('Failed to reset password to DOB:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to reset password. Please verify student date of birth is on file.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setResult(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reset Password to Default DOB</h3>
              <p className="text-xs text-amber-700 font-medium">Super Admin Credential Override</p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Credentials Reset Successfully!</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Password has been reset to the student's date of birth in <strong>DDMMYYYY</strong> format.
                </p>
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-medium">New Password:</span>
                  <code className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono font-bold rounded">
                    {result.default_password_hint}
                  </code>
                </div>
              </div>

              {result.reset_accounts && result.reset_accounts.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Updated Accounts:</p>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {result.reset_accounts.map((acc: string, idx: number) => (
                      <li key={idx} className="text-slate-700 font-mono text-[11px]">{acc}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-slate-500 italic">
                The student / parent can now log in immediately. They can change their password later from their profile.
              </p>
            </div>
          ) : (
            <>
              {/* Student Target Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <strong className="text-slate-900">{studentName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PRN / Code:</span>
                  <strong className="text-slate-900">{prn}</strong>
                </div>
                {dobFormatted && (
                  <div className="flex justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500">DOB (Password):</span>
                    <strong className="text-amber-700 font-mono font-bold">
                      {dobFormatted} ({dobPasswordPreview})
                    </strong>
                  </div>
                )}
              </div>

              {/* Target Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Select Accounts to Reset:
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="BOTH"
                      checked={target === 'BOTH'}
                      onChange={() => setTarget('BOTH')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <strong className="text-slate-900">Both Student &amp; Parent Accounts</strong>
                      <p className="text-[11px] text-slate-500">Resets password for student login and linked parent login</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="STUDENT"
                      checked={target === 'STUDENT'}
                      onChange={() => setTarget('STUDENT')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <strong className="text-slate-900">Student Account Only</strong>
                      <p className="text-[11px] text-slate-500">Leaves parent password unchanged</p>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="resetTarget"
                      value="PARENT"
                      checked={target === 'PARENT'}
                      onChange={() => setTarget('PARENT')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <strong className="text-slate-900">Parent Account Only</strong>
                      <p className="text-[11px] text-slate-500">Leaves student password unchanged</p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          {result ? (
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={loading}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Confirm &amp; Reset to DOB</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
