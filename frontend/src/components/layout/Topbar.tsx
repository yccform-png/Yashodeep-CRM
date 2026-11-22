import React from 'react';
import { Calendar, Bell, Search, Shield, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  onToggleMobileNav?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleMobileNav }) => {
  const { user } = useAuth();

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

        {/* Search Context */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student, roll, invoice..."
            className="w-full pl-9 pr-3 py-1.5 sm:py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Right Utility Widgets */}
      <div className="flex items-center space-x-2 sm:space-x-4">
        {/* Academic Year Active Badge */}
        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-medium text-slate-700 border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>AY: <strong className="text-slate-900">2026–2027</strong></span>
        </div>

        {/* Notifications */}
        <button
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white"></span>
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
    </header>
  );
};
