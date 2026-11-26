import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ArrowRight, Clock, ShieldCheck, GraduationCap, UserCheck, HelpCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'STUDENT_PARENT'>('STAFF');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSessionExpired = new URLSearchParams(location.search).get('reason') === 'inactivity';

  const handleTabChange = (tab: 'STAFF' | 'STUDENT_PARENT') => {
    setActiveTab(tab);
    setError(null);
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append('username', username.trim());
      formData.append('password', password);

      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const { access_token, ...userData } = res.data;
      login(access_token, userData);

      // Role-specific landing redirect
      if (userData.user_type === 'STUDENT' || userData.user_type === 'PARENT') {
        if (userData.student_id) {
          navigate(`/students/${userData.student_id}`);
        } else {
          navigate('/portals');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (activeTab === 'STUDENT_PARENT') {
        setError(err.response?.data?.detail || 'Invalid PRN/Roll Number or Date of Birth. Please check your credentials.');
      } else {
        setError(err.response?.data?.detail || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-8 relative z-10">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-white/95 p-2 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/10 border border-slate-700/60">
            <img src="/logo.png" alt="Yashodeep Classes" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Yashodeep Coaching Classes</h2>
          <p className="text-sm font-semibold text-amber-400 mt-1">यशोदिप क्लासेस</p>
          <p className="text-xs text-slate-400 mt-0.5">Unified Coaching & Residential ERP Platform</p>
        </div>

        {/* Portal Selection Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => handleTabChange('STAFF')}
            className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'STAFF'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staff &amp; Admin</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('STUDENT_PARENT')}
            className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'STUDENT_PARENT'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Student / Parent</span>
          </button>
        </div>

        {isSessionExpired && (
          <div className="mb-5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center space-x-2.5">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Your session expired due to 15 minutes of inactivity. Please sign in again.</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'STAFF' ? (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Official Email or Mobile ID</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yccform@gmail.com"
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">PRN, Roll No, or Parent Mobile</label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. PRN-2026-00001 or 901 or 9420010019"
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                {activeTab === 'STAFF' ? 'Account Password' : 'Password or Date of Birth (DDMMYYYY)'}
              </label>
              {activeTab === 'STUDENT_PARENT' && (
                <span className="text-[10px] text-blue-400 font-medium flex items-center space-x-1">
                  <HelpCircle className="w-3 h-3" />
                  <span>Ex: 17092002</span>
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={activeTab === 'STAFF' ? '••••••••••••' : 'DDMMYYYY (e.g. 17092002)'}
                className={`w-full pl-9 pr-4 py-2.5 text-xs bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                  activeTab === 'STAFF' ? 'focus:ring-emerald-500/30 focus:border-emerald-500' : 'focus:ring-blue-500/30 focus:border-blue-500'
                }`}
              />
            </div>
            {activeTab === 'STUDENT_PARENT' && (
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                💡 <strong className="text-slate-300">Student &amp; Parent Tip:</strong> Enter your 8-digit Date of Birth in DDMMYYYY format without slashes (e.g., <code className="text-blue-400 bg-slate-800 px-1 py-0.5 rounded">17092002</code> for 17 September 2002).
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-2 py-3 px-4 font-semibold rounded-xl text-xs transition duration-150 flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 cursor-pointer ${
              activeTab === 'STAFF'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
            }`}
          >
            <span>
              {loading
                ? 'Authenticating...'
                : activeTab === 'STAFF'
                ? 'Sign In to ERP Portal'
                : 'Open Student / Parent Portal'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
