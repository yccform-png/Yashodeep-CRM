import React, { useState, useEffect } from 'react';
import { UserCheck, X, Loader2, AlertCircle, Save, Shield } from 'lucide-react';
import api from '../api/client';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  availableRoles?: any[];
  onSuccess: (updatedStaff: any) => void;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({
  isOpen,
  onClose,
  staff,
  availableRoles = [],
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isMasterSuperAdmin = staff?.user_type === 'SUPER_ADMIN';

  useEffect(() => {
    if (staff) {
      setFirstName(staff.first_name || '');
      setLastName(staff.last_name || '');
      setEmail(staff.email || '');
      setMobile(staff.mobile || '');
      setSelectedRoles(staff.roles || (staff.user_type ? [staff.user_type] : []));
      setError('');
    }
  }, [staff]);

  if (!isOpen || !staff) return null;

  const handleRoleToggle = (code: string) => {
    if (isMasterSuperAdmin) return;
    if (selectedRoles.includes(code)) {
      if (selectedRoles.length === 1) return; // Keep at least one
      setSelectedRoles(selectedRoles.filter((r) => r !== code));
    } else {
      setSelectedRoles([...selectedRoles, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('A valid email address is required.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile: mobile.trim() || null,
      };

      if (!isMasterSuperAdmin) {
        payload.role_codes = selectedRoles;
      }

      const res = await api.patch(`/users/${staff.id}`, payload);
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to update staff user:', err);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to update user profile. Please verify unique email/mobile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-200 shadow-xs">
              <UserCheck className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isMasterSuperAdmin ? 'Edit Super Admin Profile (Self)' : `Edit Staff Admin: ${staff.first_name}`}
              </h3>
              <p className="text-xs text-slate-500">Update identity, credentials, and access scopes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Official Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Mobile */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Mobile Number <span className="text-[11px] text-slate-400">(Used for WhatsApp &amp; Login)</span>
            </label>
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g. 9879879878"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Role Scopes (Only for non-superadmin) */}
          {!isMasterSuperAdmin ? (
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">
                Assigned Operational Scopes:
              </label>
              {availableRoles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableRoles
                    .filter((r) => r.code !== 'SUPER_ADMIN')
                    .map((role) => {
                      const isChecked = selectedRoles.includes(role.code);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center space-x-2.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-medium'
                              : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleRoleToggle(role.code)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="truncate">{role.name}</span>
                        </label>
                      );
                    })}
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center space-x-2.5 text-xs text-blue-900">
                  <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Role: <strong>Operational Administrator</strong> (Admissions, Batches, Attendance, Exams, Hostel)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center space-x-2.5 text-xs text-purple-800">
              <Shield className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Master Super Admin retains unrestricted campus and financial authority.</span>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
