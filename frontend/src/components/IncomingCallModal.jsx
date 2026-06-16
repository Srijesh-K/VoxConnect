import React, { useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';

export default function IncomingCallModal({ callerPhoneNumber, onAccept, onReject }) {
  
  // Optional: Play a repetitive beep sound in the browser while ringing
  useEffect(() => {
    let audioCtx;
    let osc;
    let intervalId;

    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playRingtone = () => {
        osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4 note
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        // Beep duration 0.8s
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.8);
      };

      // Play beep every 2 seconds
      playRingtone();
      intervalId = setInterval(playRingtone, 2000);

    } catch (e) {
      console.warn('AudioContext not allowed or not supported yet:', e);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-sm glass-panel-glow rounded-3xl p-8 border border-sky-500/20 text-center relative overflow-hidden animate-pulse-slow">
        
        {/* Glowing ring animation */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-sky-500/5 rounded-full blur-xl pointer-events-none"></div>

        {/* Pulsing Phone Icon */}
        <div className="relative flex justify-center items-center w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping-slow"></div>
          <div className="absolute inset-2 bg-emerald-500/20 rounded-full animate-pulse-slow"></div>
          <div className="relative p-5 bg-gradient-to-tr from-emerald-500 to-teal-600 border border-emerald-400/30 rounded-full text-white shadow-xl shadow-emerald-500/20">
            <Phone size={36} className="animate-bounce" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-100 mb-1">Incoming Call</h3>
        <p className="text-slate-400 text-sm mb-8">VoxConnect Web Call</p>

        {/* Caller phone */}
        <div className="text-2xl font-bold text-sky-400 tracking-wide font-mono mb-8 bg-slate-900/60 py-3 px-4 rounded-2xl border border-slate-800">
          {callerPhoneNumber}
        </div>

        {/* Actions */}
        <div className="flex justify-center items-center gap-6">
          {/* Decline */}
          <button
            onClick={onReject}
            className="flex flex-col items-center gap-2"
          >
            <div className="p-4 bg-rose-500 hover:bg-rose-600 border border-rose-400/20 text-white rounded-full transition-all shadow-lg shadow-rose-500/20 hover:scale-110 active:scale-95">
              <PhoneOff size={24} />
            </div>
            <span className="text-xs font-semibold text-slate-400">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-2"
          >
            <div className="p-4 bg-emerald-500 hover:bg-emerald-600 border border-emerald-400/20 text-white rounded-full transition-all shadow-lg shadow-emerald-500/20 hover:scale-110 active:scale-95">
              <Phone size={24} />
            </div>
            <span className="text-xs font-semibold text-slate-400">Accept</span>
          </button>
        </div>

      </div>
    </div>
  );
}
