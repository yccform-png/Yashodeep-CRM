import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Default timeout settings:
// - Warning triggered at: 13 minutes (780,000 ms) of inactivity
// - Instant logout triggered at: 15 minutes (900,000 ms) of inactivity (2-minute countdown)
// - Sliding token renewal interval: every 10 minutes (600,000 ms) of active usage
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_WARNING_TIMEOUT_MS = 13 * 60 * 1000;
const SLIDING_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

interface SessionTimeoutModalProps {
  idleTimeoutMs?: number;
  warningTimeoutMs?: number;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  warningTimeoutMs = DEFAULT_WARNING_TIMEOUT_MS,
}) => {
  const { user, isAuthenticated, logout, refreshToken } = useAuth();
  const navigate = useNavigate();

  // If accessing via PWA standalone mode, on mobile, or as a Student / Parent,
  // do NOT aggressively log out after 15 minutes of idle screen.
  // Their session is persisted via the 90-day sliding refresh token.
  const isPWAOrMobile =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    user?.user_type === 'STUDENT' ||
    user?.user_type === 'PARENT';

  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  // References to keep state accurate without re-binding event listeners
  const lastActivityRef = useRef<number>(Date.now());
  const lastRefreshRef = useRef<number>(Date.now());
  const isWarningVisibleRef = useRef<boolean>(false);

  // Keep ref synchronized with state
  useEffect(() => {
    isWarningVisibleRef.current = showWarning;
  }, [showWarning]);

  // Handler to extend / keep session alive
  const handleStayLoggedIn = useCallback(async () => {
    lastActivityRef.current = Date.now();
    lastRefreshRef.current = Date.now();
    setShowWarning(false);
    isWarningVisibleRef.current = false;
    await refreshToken();
  }, [refreshToken]);

  // Handler for explicit logout
  const handleLogout = useCallback(() => {
    setShowWarning(false);
    isWarningVisibleRef.current = false;
    logout();
    navigate('/login?reason=inactivity');
  }, [logout, navigate]);

  // Activity listener (tracks user movement / interaction)
  useEffect(() => {
    if (!isAuthenticated || isPWAOrMobile) return;

    // Reset baseline timers on mount or auth state change
    lastActivityRef.current = Date.now();
    lastRefreshRef.current = Date.now();

    let lastRecordedActivity = 0;

    const handleUserActivity = () => {
      const now = Date.now();

      // If warning modal is currently showing, any user interaction dismisses it and stays logged in
      if (isWarningVisibleRef.current) {
        handleStayLoggedIn();
        return;
      }

      // Throttle event updates to at most once per 1000ms to preserve UI responsiveness
      if (now - lastRecordedActivity < 1000) return;
      lastRecordedActivity = now;
      lastActivityRef.current = now;

      // Sliding session: if user has been continuously active and 10 mins passed since last token refresh,
      // silently renew the JWT token in background so active sessions NEVER expire
      if (now - lastRefreshRef.current >= SLIDING_REFRESH_INTERVAL_MS) {
        lastRefreshRef.current = now;
        refreshToken();
      }
    };

    // Attach interaction event listeners
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [isAuthenticated, handleStayLoggedIn, refreshToken]);

  // Interval timer checking for idle timeout and driving the countdown
  useEffect(() => {
    if (!isAuthenticated || isPWAOrMobile) {
      setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;

      // 1. Instant logout when idle limit reached
      if (idleTime >= idleTimeoutMs) {
        clearInterval(interval);
        setShowWarning(false);
        isWarningVisibleRef.current = false;
        logout();
        navigate('/login?reason=inactivity');
        return;
      }

      // 2. Trigger countdown warning at warning threshold (13 minutes)
      if (idleTime >= warningTimeoutMs) {
        const remainingMs = idleTimeoutMs - idleTime;
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        setSecondsRemaining(remainingSec);
        setShowWarning(true);
      } else {
        if (isWarningVisibleRef.current) {
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, idleTimeoutMs, warningTimeoutMs, logout, navigate]);

  if (!isAuthenticated || !showWarning || isPWAOrMobile) {
    return null;
  }

  // Format seconds into MM:SS
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Calculate percentage of remaining warning period (120s total countdown)
  const totalWarningSec = Math.max(1, Math.round((idleTimeoutMs - warningTimeoutMs) / 1000));
  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / totalWarningSec) * 100));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleStayLoggedIn}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-7 relative overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle radial warning glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"></div>

        {/* Pulsing Clock Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 relative">
          <Clock className="w-7 h-7 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
        </div>

        <h3 id="session-timeout-title" className="text-lg font-bold text-white tracking-tight">
          Session Expiring Soon
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          You have been inactive for 13 minutes. For security reasons, your ERP session will automatically terminate in:
        </p>

        {/* Monospace Countdown Clock */}
        <div className="my-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center">
          <div className="text-3xl sm:text-4xl font-mono font-extrabold text-amber-400 tracking-wider">
            {formattedTime}
          </div>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
            Minutes : Seconds Remaining
          </span>

          {/* Shrinking progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                secondsRemaining <= 30 ? 'bg-rose-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mb-6">
          Move your mouse, press any key, or click <strong className="text-emerald-400">Stay Logged In</strong> to continue working uninterrupted.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleStayLoggedIn}
            className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition duration-150 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Stay Logged In</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl text-xs transition duration-150 flex items-center justify-center space-x-1.5 border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
