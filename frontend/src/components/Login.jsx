import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Phone, Lock, Key, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const { requestOtp, verifyOtp, error: authError } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1 = Phone Number, 2 = OTP
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [mockOtpHelp, setMockOtpHelp] = useState('');

  // Handle Phone Submission
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    if (!phoneNumber) {
      setLocalError('Phone number is required');
      setLoading(false);
      return;
    }

    try {
      const result = await requestOtp(phoneNumber);
      setStep(2);
      if (result.mockOtp) {
        setMockOtpHelp(result.mockOtp);
      }
    } catch (err) {
      setLocalError(err.message || 'Error requesting OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP Submission
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    if (!otp) {
      setLocalError('OTP code is required');
      setLoading(false);
      return;
    }

    try {
      await verifyOtp(phoneNumber, otp);
    } catch (err) {
      setLocalError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep(1);
    setOtp('');
    setLocalError('');
    setMockOtpHelp('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-radial-gradient p-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel-glow rounded-3xl p-8 relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 text-sky-400 mb-4 animate-pulse-slow">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            VoxConnect
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Free voice calls when your mobile recharge expires
          </p>
        </div>

        {/* Errors */}
        {(localError || authError) && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {localError || authError}
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: ENTER PHONE NUMBER */
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                  <Phone size={18} />
                </span>
                <input
                  type="tel"
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., +1234567890"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-100 placeholder-slate-500 transition-all"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Include country code (e.g. +91XXXXXXXXXX or +1XXXXXXXXXX)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Get OTP Code <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: ENTER OTP */
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-2">
                Verification Code (OTP)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                  <Lock size={18} />
                </span>
                <input
                  type="text"
                  id="otp"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-100 placeholder-slate-500 transition-all text-center tracking-widest font-mono text-lg"
                  required
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-400">
                  Sent to {phoneNumber}
                </span>
                <button
                  type="button"
                  onClick={handleBackToPhone}
                  className="text-xs text-sky-400 hover:underline focus:outline-none"
                  disabled={loading}
                >
                  Change number
                </button>
              </div>
            </div>

            {mockOtpHelp && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-sky-500/10 text-center">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 mb-1.5">
                  <Key size={12} className="text-sky-400" /> Mock OTP received:
                </p>
                <button
                  type="button"
                  onClick={() => setOtp(mockOtpHelp)}
                  className="font-mono font-bold text-lg text-sky-400 hover:text-sky-300 tracking-wider bg-sky-500/10 border border-sky-500/20 hover:border-sky-500/40 px-3 py-1 rounded-lg transition-all"
                >
                  {mockOtpHelp}
                </button>
                <p className="text-[10px] text-slate-500 mt-1">
                  (Click code to auto-fill)
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Verify & Connect'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
