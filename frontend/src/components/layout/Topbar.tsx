import React, { useState } from 'react';
import { Calendar, Bell, Search, Shield, ChevronDown, Menu, GraduationCap, KeyRound, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { ChangePasswordModal } from '../ChangePasswordModal';

interface TopbarProps {
  onToggleMobileNav?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileNav }) => {
  const { user } = useAuth();
  const { academicYears, selectedAcademicYear, setSelectedAcademicYear } = useAcademicYear();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAyMenuOpen, setIsAyMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between flex-shrink-0 z-30">
      {/* Mobile Menu Trigger & Search */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 max-w-xs sm:max-w-md">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Search Context for Staff / Portal Title for Student & Parent */}
        {user?.user_type === 'STUDENT' || user?.user_type === 'PARENT' ? (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50/80 text-blue-900 border border-blue-200/80 rounded-xl text-xs font-bold">
            <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="truncate">
              {user?.user_type === 'STUDENT' ? 'Student Self-Service Portal' : 'Parent Monitoring Portal'}
            </span>
          </div>
        ) : (
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search student, roll, invoice..."
              className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Right Utility Widgets */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Academic Year Active Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAyMenuOpen(!isAyMenuOpen)}
            className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-xl text-xs font-medium text-slate-700 border border-slate-200 transition cursor-pointer"
            title="Click to Switch Academic Year"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline text-slate-500">AY:</span>
            <strong className="text-slate-900 font-bold">
              {selectedAcademicYear ? selectedAcademicYear.name : 'Loading...'}
            </strong>
            {selectedAcademicYear?.is_current && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 hidden md:inline">
                CURRENT
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isAyMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsAyMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Academic Session
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Filters students, batches, and records
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-50">
                  {academicYears.map((ay) => {
                    const isSelected = selectedAcademicYear?.id === ay.id;
                    return (
                      <div
                        key={ay.id}
                        className={`px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                          isSelected ? 'bg-blue-50/70' : ''
                        }`}
                        onClick={() => {
                          setSelectedAcademicYear(ay);
                          setIsAyMenuOpen(false);
                        }}
                      >
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                              {ay.name}
                            </span>
                            {ay.is_current && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Active Current
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {ay.code} ({ay.start_date.substring(0, 4)}–{ay.end_date.substring(0, 4)})
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notifications */}
        <button
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white"></span>
        </button>

        {/* Change Password Trigger */}
        <button
          onClick={() => setIsChangePasswordOpen(true)}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
          title="Change Account Password"
          aria-label="Change Password"
        >
          <KeyRound className="w-4 h-4" />
        </button>

        {/* User Pill */}
        <div className="flex items-center space-x-2 sm:space-x-2.5 pl-1.5 sm:pl-2 border-l border-slate-200">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-slate-800">
              {user ? `${user.first_name} ${user.last_name}` : 'Admin'}
            </p>
            <p className="text-[10px] text-slate-500">{user?.email || 'admin@yashodeep.in'}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
            {user ? `${user.first_name[0]}` : 'Y'}
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}
    </header>
  );
};
