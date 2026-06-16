import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, Settings, Users, PhoneCall, ArrowLeft, Key, Save, 
  Trash2, Edit, RefreshCw, Check, Clock, UserCheck 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminPanel({ onBack }) {
  const { token } = useAuth();
  
  // Admin auth
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem('adminKey') || '');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Panel state
  const [activeTab, setActiveTab] = useState('settings'); // settings, users, calls
  const [config, setConfig] = useState({ maxCallDurationSeconds: 300, defaultTrialsCount: 5 });
  const [users, setUsers] = useState([]);
  const [calls, setCalls] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editTrialsVal, setEditTrialsVal] = useState('');
  
  // Status/Notice states
  const [notice, setNotice] = useState({ text: '', type: 'success' }); // type: success, error
  const [loading, setLoading] = useState(false);

  // Auto-clear notice
  useEffect(() => {
    if (notice.text) {
      const timer = setTimeout(() => setNotice({ text: '', type: 'success' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice.text]);

  // If session already has key, try to load config immediately
  useEffect(() => {
    if (adminKey) {
      tryAutoUnlock();
    }
  }, []);

  const tryAutoUnlock = async () => {
    setUnlockLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setIsUnlocked(true);
        fetchUsers(adminKey);
        fetchCalls(adminKey);
      } else {
        sessionStorage.removeItem('adminKey');
        setAdminKey('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUnlockLoading(false);
    }
  };

  // Handle Unlock Submit
  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlockError('');
    setUnlockLoading(true);

    if (!adminKey) {
      setUnlockError('Admin Access Key is required');
      setUnlockLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid access key');
      }

      sessionStorage.setItem('adminKey', adminKey);
      setConfig(data);
      setIsUnlocked(true);
      
      // Load tables
      fetchUsers(adminKey);
      fetchCalls(adminKey);
    } catch (err) {
      setUnlockError(err.message || 'Verification failed');
    } finally {
      setUnlockLoading(false);
    }
  };

  // Fetch Users
  const fetchUsers = async (key = adminKey) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { 'X-Admin-Key': key }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  };

  // Fetch Calls
  const fetchCalls = async (key = adminKey) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/calls`, {
        headers: { 'X-Admin-Key': key }
      });
      if (res.ok) {
        const data = await res.json();
        setCalls(data);
      }
    } catch (e) {
      console.error('Error fetching call logs:', e);
    }
  };

  // Save Config Settings
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify(config)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update config');
      
      setConfig(data);
      setNotice({ text: 'System settings updated successfully!', type: 'success' });
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Edit Trials
  const handleSaveTrials = async (userId) => {
    if (isNaN(parseInt(editTrialsVal)) || parseInt(editTrialsVal) < 0) {
      setNotice({ text: 'Please enter a valid trials count (>= 0)', type: 'error' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/trials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
        },
        body: JSON.stringify({ trialsRemaining: parseInt(editTrialsVal) })
      });
      
      if (!res.ok) throw new Error('Failed to update trials');
      
      setEditingUserId(null);
      setEditTrialsVal('');
      setNotice({ text: 'User trials updated successfully!', type: 'success' });
      fetchUsers();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    }
  };

  // Delete User
  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user profile? All call logs will remain but the user will be wiped.')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': adminKey }
      });
      
      if (!res.ok) throw new Error('Failed to delete user');
      
      setNotice({ text: 'User profile deleted successfully!', type: 'success' });
      fetchUsers();
    } catch (err) {
      setNotice({ text: err.message, type: 'error' });
    }
  };

  // Format MM:SS helper
  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  /* UNLOCKED RENDER SCREEN */
  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
        {/* Neon Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md glass-panel-glow rounded-3xl p-8 relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs mb-6 focus:outline-none"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>

          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400 mb-4">
              <ShieldAlert size={36} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Admin Access Required
            </h1>
            <p className="text-slate-400 text-xs mt-2">
              Enter the unique security key to unlock system configuration panels
            </p>
          </div>

          {unlockError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-semibold">
              {unlockError}
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-6">
            <div>
              <label htmlFor="adminKey" className="block text-sm font-medium text-slate-300 mb-2">
                Secret Access Key
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                  <Key size={18} />
                </span>
                <input
                  type="password"
                  id="adminKey"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter admin access key"
                  disabled={unlockLoading}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-slate-100 placeholder-slate-600 transition-all font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                (Default dev key is: <span className="font-mono text-slate-400">voxconnect_admin_key_2026</span>)
              </p>
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-semibold rounded-2xl shadow-lg focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all disabled:opacity-50"
            >
              {unlockLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Unlock Admin Panel'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* FULL ADMIN PANEL VIEW */
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-12">
      {/* Header */}
      <header className="w-full glass-panel border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-all"
              title="Return to Dashboard"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-lg font-bold bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
              Admin Control Center
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-1 rounded-md">
              Secure Session
            </span>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 w-full flex-grow space-y-6">
        
        {/* Notice alert */}
        {notice.text && (
          <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-bounce ${
            notice.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {notice.type === 'success' ? <Check size={16} /> : <ShieldAlert size={16} />}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 max-w-md">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings size={14} /> Settings
          </button>
          <button
            onClick={() => { setActiveTab('users'); fetchUsers(); }}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={14} /> Users ({users.length})
          </button>
          <button
            onClick={() => { setActiveTab('calls'); fetchCalls(); }}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'calls'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PhoneCall size={14} /> Call History ({calls.length})
          </button>
        </div>

        {/* TAB 1: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-white/5 relative overflow-hidden">
            <h2 className="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Settings size={20} className="text-rose-400" /> Configuration Manager
            </h2>
            <p className="text-xs text-slate-400 mb-8">
              Adjust global timers, caps, and limit constraints. Changes reflect instantly on subsequent calls.
            </p>

            <form onSubmit={handleSaveConfig} className="max-w-md space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Maximum Call Duration
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={config.maxCallDurationSeconds}
                    onChange={(e) => setConfig({ ...config, maxCallDurationSeconds: Math.max(5, parseInt(e.target.value) || 5) })}
                    className="w-32 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-slate-100 text-center font-semibold"
                    required
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-semibold">seconds</span>
                    <span className="text-[10px] text-rose-400 font-mono">
                      (Formatted: {formatSeconds(config.maxCallDurationSeconds)} minutes)
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  System cap after which active WebRTC audio channels will be auto-terminated.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Default Trials Count
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={config.defaultTrialsCount}
                    onChange={(e) => setConfig({ ...config, defaultTrialsCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-32 px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-slate-100 text-center font-semibold"
                    required
                  />
                  <span className="text-xs text-slate-400 font-semibold">calls</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Starting credit assigned to newly registered phone numbers.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 py-3 px-6 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save size={16} /> Save System Settings
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: USERS LIST */}
        {activeTab === 'users' && (
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800/80">
            <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200">Registered Accounts</h3>
                <p className="text-xs text-slate-400">View user credentials, edit call credits, or delete profiles.</p>
              </div>
              <button
                onClick={() => fetchUsers()}
                className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-all"
                title="Refresh Table"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-800/40">
                    <th className="py-3 px-6">Phone Number</th>
                    <th className="py-3 px-6">Date Registered</th>
                    <th className="py-3 px-6 text-center">Call Trials Left</th>
                    <th className="py-3 px-6 text-center">Total Minutes Called</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
                  {users.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-200 font-mono">
                        {item.phoneNumber}
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs">
                        {formatDate(item.createdAt || new Date())}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {editingUserId === item._id ? (
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="number"
                              value={editTrialsVal}
                              onChange={(e) => setEditTrialsVal(e.target.value)}
                              className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-center font-bold text-slate-200 focus:outline-none focus:border-rose-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveTrials(item._id)}
                              className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded-md border border-emerald-500/20"
                              title="Confirm Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => { setEditingUserId(null); setEditTrialsVal(''); }}
                              className="p-1 text-slate-400 hover:bg-slate-800 rounded-md border border-slate-700"
                              title="Cancel"
                            >
                              <ArrowLeft size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1 font-bold ${item.trialsRemaining > 0 ? 'text-amber-400' : 'text-red-500'}`}>
                            {item.trialsRemaining} / 5
                            <button
                              onClick={() => { setEditingUserId(item._id); setEditTrialsVal(item.trialsRemaining); }}
                              className="p-1 text-slate-500 hover:text-slate-300 ml-1"
                              title="Edit trials count"
                            >
                              <Edit size={12} />
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-xs text-indigo-400">
                        {item.totalMinutesUsed.toFixed(2)} min
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDeleteUser(item._id)}
                          className="p-2 text-rose-400 hover:text-white hover:bg-rose-500/20 border border-transparent hover:border-rose-500/20 rounded-xl transition-all"
                          title="Delete User Account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CALL LOGS */}
        {activeTab === 'calls' && (
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800/80">
            <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-200">Global Call Logs</h3>
                <p className="text-xs text-slate-400">Chronological history log of all voice calling sessions.</p>
              </div>
              <button
                onClick={() => fetchCalls()}
                className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-xl transition-all"
                title="Refresh Table"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-800/40">
                    <th className="py-3 px-6">Caller</th>
                    <th className="py-3 px-6">Recipient</th>
                    <th className="py-3 px-6">Date & Time</th>
                    <th className="py-3 px-6 text-center">Duration</th>
                    <th className="py-3 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
                  {calls.map((call) => {
                    const callerNum = typeof call.caller === 'object' ? call.caller?.phoneNumber : 'Deleted Caller';
                    const recipientNum = typeof call.recipient === 'object' ? call.recipient?.phoneNumber : call.recipientPhoneNumber;
                    
                    return (
                      <tr key={call._id} className="hover:bg-slate-900/20 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-300 font-mono">
                          {callerNum}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-300 font-mono">
                          {recipientNum}
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-xs">
                          {formatDate(call.createdAt)}
                        </td>
                        <td className="py-4 px-6 text-center font-mono text-xs">
                          <span className="inline-flex items-center gap-1 justify-center">
                            <Clock size={12} className="text-slate-500" /> {formatSeconds(call.duration)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            call.status === 'completed' 
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : call.status === 'rejected'
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          }`}>
                            {call.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
