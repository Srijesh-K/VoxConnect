import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';

function MainApp() {
  const { user, token, loading } = useAuth();
  const [view, setView] = useState('dashboard'); // dashboard, admin

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="relative flex flex-col items-center gap-4 z-10">
          <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            VoxConnect
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold animate-pulse">
            Initializing secure lines...
          </p>
        </div>
      </div>
    );
  }

  // Render Login if no authenticated session
  if (!token || !user) {
    return <Login />;
  }

  // Render AdminPanel or Dashboard based on view state
  return view === 'admin' ? (
    <AdminPanel onBack={() => setView('dashboard')} />
  ) : (
    <Dashboard onAdminClick={() => setView('admin')} />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
