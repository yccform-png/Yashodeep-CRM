import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  Armchair,
  Home,
  CalendarCheck,
  Award,
  Layers,
  LogOut,
  Building2,
  ShieldCheck,
  Tag,
  Landmark,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInstitute } from '../../context/InstituteContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout, hasRole } = useAuth();
  const { institute } = useInstitute();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'STUDY_ROOM_MANAGER'] },
    { name: 'New Admission', path: '/admissions', icon: UserPlus, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Students Registry', path: '/students', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'STUDY_ROOM_MANAGER'] },
    { name: 'Dynamic Fee Engine', path: '/fees', icon: DollarSign, roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'] },
    { name: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { name: 'Academics & Batches', path: '/academics', icon: GraduationCap, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Exams & Results', path: '/examinations', icon: Award, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
    { name: 'Study Room (150 Seats)', path: '/study-room', icon: Armchair, roles: ['SUPER_ADMIN', 'ADMIN', 'STUDY_ROOM_MANAGER'] },
    { name: 'Hostel Facilities', path: '/hostel', icon: Home, roles: ['SUPER_ADMIN', 'ADMIN', 'HOSTEL_WARDEN'] },
    { name: 'Facility Plans & Pricing', path: '/facility-plans', icon: Tag, roles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'STUDY_ROOM_MANAGER'] },
    { name: 'Institute Profile', path: '/institute-settings', icon: Landmark, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Role Portals', path: '/portals', icon: Layers, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'ACCOUNTANT', 'HOSTEL_WARDEN', 'STUDY_ROOM_MANAGER', 'STUDENT', 'PARENT'] },
  ];

  const filteredItems = navItems.filter((item) => hasRole(item.roles));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Sidebar (Drawer on mobile/tablet, Fixed on desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-64 bg-slate-900 text-slate-200 flex flex-col h-screen border-r border-slate-800 flex-shrink-0 select-none shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:shadow-none lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/95 p-1 flex items-center justify-center shrink-0 shadow-md border border-slate-700/60">
              <img src="/logo.png" alt="Yashodeep Classes" className="w-full h-full object-contain" />
            </div>
            <div className="truncate">
              <h1 className="font-bold text-sm tracking-tight text-white truncate max-w-[150px]" title={institute?.name || 'Yashodeep Coaching Classes'}>
                {institute?.name ? institute.name.toUpperCase() : 'YASHODEEP CLASSES'}
              </h1>
              <p className="text-[11px] text-amber-400 font-semibold truncate">यशोदिप क्लासेस ERP</p>
            </div>
          </div>

          {/* Close button on mobile/tablet */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Institute Modules
          </div>
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (onClose) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-emerald-400">
              {user ? `${user.first_name[0]}${user.last_name[0]}` : 'U'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">
                {user ? `${user.first_name} ${user.last_name}` : 'Administrator'}
              </p>
              <div className="flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-slate-400 font-medium uppercase truncate">
                  {user?.user_type || 'ADMIN'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
};
