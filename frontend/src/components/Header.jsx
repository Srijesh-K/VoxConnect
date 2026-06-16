import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, PhoneCall, BarChart2, Shield } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  // Formats duration (e.g. 5.25 -> 5m 15s)
  const formatMinutes = (totalMinutes) => {
    if (!totalMinutes) return '0m';
    const mins = Math.floor(totalMinutes);
    const secs = Math.round((totalMinutes - mins) * 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <header className="w-full glass-panel border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
            <PhoneCall size={20} className="animate-pulse-slow" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            VoxConnect
          </span>
        </div>

        {/* Stats & Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          
          {/* User Info (Mobile: icon, Desktop: phone) */}
          <div className="hidden md:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-200">
              {user.phoneNumber}
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 justify-end">
              <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping"></span>
              Connected
            </span>
          </div>

          {/* Trials Metric */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-2xl">
            <Shield size={14} className="text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Trials Left</span>
              <span className="text-xs font-bold text-slate-200 leading-3">
                <span className={user.trialsRemaining > 0 ? 'text-amber-400' : 'text-red-500'}>
                  {user.trialsRemaining}
                </span>
                /5
              </span>
            </div>
          </div>

          {/* Call Time Metric */}
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-2xl">
            <BarChart2 size={14} className="text-indigo-400" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Call Time</span>
              <span className="text-xs font-bold text-indigo-400 leading-3">
                {formatMinutes(user.totalMinutesUsed)}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>

      </div>
    </header>
  );
}
