import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Volume2, ShieldAlert } from 'lucide-react';

export default function ActiveCall({ callSession, onHangup, connectionState }) {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Timer effect: counts up once the session is connected
  useEffect(() => {
    let timerId;

    if (callSession.status === 'connected') {
      setSeconds(0);
      timerId = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [callSession.status]);

  // Formats seconds into MM:SS
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRinging = callSession.status === 'ringing';
  const isConnected = callSession.status === 'connected';

  // Toggle local mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (callSession.localStream) {
      callSession.localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle enabled state
      });
    }
  };

  // Warning when approaching the 5-minute limit (starts at 4:30, i.e., 270 seconds)
  const remainingSeconds = 300 - seconds;
  const isApproachingLimit = isConnected && seconds >= 270 && seconds < 300;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
      
      {/* Background glow grids */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-md glass-panel-glow rounded-3xl p-8 border border-white/10 text-center relative overflow-hidden">
        
        {/* Connection State Badge */}
        <div className="mb-4">
          {isRinging && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <span className="h-1.5 w-1.5 bg-amber-400 rounded-full animate-ping"></span>
              Ringing...
            </span>
          )}
           {isConnected && (
            <div className="flex justify-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                {connectionState === 'connected' ? 'Secure Connection' : 'Connecting Peer...'}
              </span>
              {connectionState === 'connected' && (
                <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                  <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-ping"></span>
                  Recording
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recipient Number */}
        <h2 className="text-3xl font-extrabold text-slate-100 font-mono tracking-wide mb-2">
          {callSession.role === 'caller' ? callSession.recipientPhoneNumber : callSession.callerPhoneNumber}
        </h2>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-8">
          {callSession.role === 'caller' ? 'Outgoing Session' : 'Incoming Session'}
        </p>

        {/* Timer or Rings Animation */}
        <div className="my-8">
          {isConnected ? (
            <div className="flex flex-col items-center">
              <div className="text-5xl font-mono font-bold tracking-widest text-sky-400 mb-2">
                {formatTime(seconds)}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                Duration Limit: 05:00
              </div>
            </div>
          ) : (
            /* Pulsing rings during ringing phase */
            <div className="relative flex justify-center items-center w-28 h-28 mx-auto my-4">
              <div className="absolute inset-0 bg-sky-500/10 rounded-full animate-ping-slow"></div>
              <div className="absolute inset-4 bg-indigo-500/20 rounded-full animate-pulse-slow"></div>
              <div className="relative p-6 bg-slate-900 border border-slate-700 rounded-full text-sky-400">
                <Volume2 size={40} className="animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* CSS waveform audio visualizer */}
        {isConnected && connectionState === 'connected' && !isMuted && (
          <div className="flex justify-center items-end gap-1.5 h-10 my-8">
            <div className="w-1 bg-sky-500 rounded-full animate-bounce h-10" style={{ animationDelay: '0.1s', animationDuration: '0.8s' }}></div>
            <div className="w-1 bg-sky-400 rounded-full animate-bounce h-6" style={{ animationDelay: '0.3s', animationDuration: '0.6s' }}></div>
            <div className="w-1 bg-indigo-500 rounded-full animate-bounce h-8" style={{ animationDelay: '0.2s', animationDuration: '0.7s' }}></div>
            <div className="w-1 bg-indigo-400 rounded-full animate-bounce h-4" style={{ animationDelay: '0.5s', animationDuration: '0.5s' }}></div>
            <div className="w-1 bg-purple-500 rounded-full animate-bounce h-7" style={{ animationDelay: '0.4s', animationDuration: '0.9s' }}></div>
          </div>
        )}

        {/* Approaching Limit Warning */}
        {isApproachingLimit && (
          <div className="my-6 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center gap-2 text-red-400 text-xs font-semibold animate-pulse">
            <ShieldAlert size={14} />
            <span>Call auto-disconnects in {remainingSeconds} seconds!</span>
          </div>
        )}

        {/* Buttons Controls */}
        <div className="flex justify-center items-center gap-6 mt-8">
          
          {/* Mute */}
          <button
            onClick={toggleMute}
            disabled={!isConnected}
            className={`p-3.5 border rounded-2xl transition-all ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-slate-900/60 border-slate-700/50 text-slate-300 hover:bg-slate-900 hover:text-white'
            } disabled:opacity-30 disabled:pointer-events-none`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Hang Up (Red) */}
          <button
            onClick={onHangup}
            className="p-5 bg-rose-500 hover:bg-rose-600 border border-rose-400/20 text-white rounded-full transition-all shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95"
            title="End Call"
          >
            <PhoneOff size={28} />
          </button>

          {/* Speaker (Placeholder toggle) */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            disabled={!isConnected}
            className={`p-3.5 border rounded-2xl transition-all ${
              isSpeakerOn
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                : 'bg-slate-900/60 border-slate-700/50 text-slate-300 hover:bg-slate-900 hover:text-white'
            } disabled:opacity-30 disabled:pointer-events-none`}
            title={isSpeakerOn ? 'Speaker Off' : 'Speaker On'}
          >
            <Volume2 size={20} />
          </button>
        </div>

      </div>
    </div>
  );
}
