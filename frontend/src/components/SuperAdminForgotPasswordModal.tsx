import React, { useState, useEffect } from 'react';
import { Shield, MessageSquare, Mail, KeyRound, Eye, EyeOff, X, Loader2, CheckCircle2, AlertCircle, ArrowRight, RotateCw } from 'lucide-react';
import api from '../api/client';

interface SuperAdminForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SuperAdminForgotPasswordModal: React.FC<SuperAdminForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'REQUEST_OTP' | 'VERIFY_OTP' | 'SUCCESS'>('REQUEST_OTP');
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [maskedDestination, setMaskedDestination] = useState('');

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  // Countdown timer for OTP
  useEffect(() => {
    let timer: any = null;
    if (step === 'VERIFY_OTP' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, timeLeft]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your Super Admin registered email or mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/request-otp', {
        identifier: identifier.trim(),
        channel
      });
      setMaskedDestination(res.data.destination_masked || identifier);
      setTimeLeft(300);
      setStep('VERIFY_OTP');
    } catch (err: any) {
      console.error('Failed to request OTP:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Unable to dispatch verification code. Please check your identifier.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password/verify-and-reset', {
        identifier: identifier.trim(),
        otp: otp.trim(),
        new_password: newPassword
      });
      setStep('SUCCESS');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to verify OTP and reset password:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    setStep('REQUEST_OTP');
    setIdentifier('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 shadow-xs">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Super Admin Password Recovery</h3>
              <p className="text-xs text-purple-200">Self-Service Multi-Channel OTP Verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= STEP 1: REQUEST OTP ================= */}
          {step === 'REQUEST_OTP' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your registered Super Admin email or mobile number. Select whether you prefer to receive your 6-digit verification code via WhatsApp or Email.
              </p>

              {/* Identifier */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Super Admin Email or Mobile
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. yccform@gmail.com or +919999990001"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                />
              </div>

              {/* Delivery Channel Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Choose OTP Delivery Method:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setChannel('WHATSAPP')}
                    className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 cursor-pointer ${
                      channel === 'WHATSAPP'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">WhatsApp</p>
                      <p className="text-[10px] text-slate-500">Instant direct message</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('EMAIL')}
                    className={`p-3 rounded-xl border text-left transition flex items-center space-x-2.5 cursor-pointer ${
                      channel === 'EMAIL'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Official Email</p>
                      <p className="text-[10px] text-slate-500">Inbox verification</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= STEP 2: VERIFY OTP & RESET ================= */}
          {step === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <strong className="text-slate-900">{maskedDestination}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    channel === 'WHATSAPP' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {channel === 'WHATSAPP' ? 'WhatsApp Message' : 'Email Message'}
                  </span>
                </div>
              </div>

              {/* OTP Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    6-Digit Verification Code
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${timeLeft < 60 ? 'text-rose-600' : 'text-slate-500'}`}>
                    ⏱️ {formatTimer(timeLeft)}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[8px] text-lg font-mono font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  New Super Admin Password <span className="text-[11px] text-slate-400">(Min. 8 characters)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new master password"
                    className="w-full px-3 py-2 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new master password"
                    className="w-full px-3 py-2 pr-10 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Resend & Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  disabled={timeLeft > 240 || loading}
                  onClick={() => handleRequestOtp()}
                  className="inline-flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Resend Code</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setStep('REQUEST_OTP')}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>Verify &amp; Reset Password</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= STEP 3: SUCCESS ================= */}
          {step === 'SUCCESS' && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h4 className="text-sm font-bold text-emerald-900">Super Admin Password Updated!</h4>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Your master account credentials have been successfully updated. You can now log in using your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Return to Login
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
