import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X, Loader2, AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import api from '../api/client';

interface ResetStaffPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  onSuccess?: () => void;
}

export const ResetStaffPasswordModal: React.FC<ResetStaffPasswordModalProps> = ({
  isOpen,
  onClose,
  staff,
  onSuccess
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !staff) return null;

  const staffName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Staff Admin';

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(res);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/users/${staff.id}/reset-password`, { new_password: newPassword });
      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to reset staff password:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setNewPassword('');
    setError('');
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-xs">
              <KeyRound className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reset Staff Password</h3>
              <p className="text-xs text-amber-700 font-medium">Super Admin Credential Override</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {isSuccess ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Password Reset Successfully!</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  The password for <strong>{staffName}</strong> has been updated. They can now log in using the new credentials.
                </p>
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-xs">
                  <span className="text-emerald-800 font-medium">New Password:</span>
                  <code className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono font-bold rounded">
                    {newPassword}
                  </code>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Staff Target Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Staff Member:</span>
                  <strong className="text-slate-900">{staffName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <strong className="text-slate-900">{staff.email}</strong>
                </div>
                {staff.mobile && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mobile:</span>
                    <strong className="text-slate-900">{staff.mobile}</strong>
                  </div>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    New Password <span className="text-[11px] text-slate-400">(Min. 8 characters)</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password for admin"
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleModalClose}
                  disabled={loading}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Resetting...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Set New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
