import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { PhoneIncoming, PhoneOutgoing, Calendar, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { listRecordings, getRecording, deleteRecording } from '../utils/recordingDb';

export default function CallHistory({ history }) {
  const { user } = useAuth();
  
  const [recordingsList, setRecordingsList] = useState([]);
  const [playingCallId, setPlayingCallId] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

  const refreshRecordings = async () => {
    const list = await listRecordings();
    setRecordingsList(list);
  };

  useEffect(() => {
    refreshRecordings();

    const handleRecordingSaved = () => {
      refreshRecordings();
    };

    window.addEventListener('recording-saved', handleRecordingSaved);
    return () => {
      window.removeEventListener('recording-saved', handleRecordingSaved);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const handlePlayRecording = async (callId) => {
    // Stop currently playing audio
    if (audioElement) {
      audioElement.pause();
      if (playingCallId === callId) {
        setPlayingCallId(null);
        setAudioElement(null);
        return;
      }
    }

    // Fetch audio recording from IndexedDB
    const record = await getRecording(callId);
    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingCallId(null);
        setAudioElement(null);
      };
      audio.play().catch(err => console.error('Failed to play recording:', err));
      setPlayingCallId(callId);
      setAudioElement(audio);
    } else {
      alert('Recording file not found.');
    }
  };

  const handleDownloadRecording = async (callId, phoneNumber) => {
    const record = await getRecording(callId);
    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${phoneNumber || 'call'}_${callId.substring(0, 8)}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      alert('Recording file not found.');
    }
  };

  const handleDeleteRecording = async (callId) => {
    if (window.confirm('Are you sure you want to delete this call recording?')) {
      if (audioElement && playingCallId === callId) {
        audioElement.pause();
        setPlayingCallId(null);
        setAudioElement(null);
      }
      await deleteRecording(callId);
      await refreshRecordings();
    }
  };

  // Format date to local string
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

  // Format duration in seconds to MM:SS
  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle2 size={10} /> Completed
          </span>
        );
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 animate-pulse">
            Connected
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <AlertTriangle size={10} /> Rejected
          </span>
        );
      case 'missed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
            <XCircle size={10} /> Missed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
            <XCircle size={10} /> Failed
          </span>
        );
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-8 text-center border border-slate-800/80">
        <p className="text-slate-400 text-sm">No call history available yet</p>
        <p className="text-xs text-slate-500 mt-1">Make your first free call above!</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800/80">
      <div className="px-6 py-5 border-b border-slate-800/80">
        <h3 className="text-lg font-bold text-slate-200">Recent Calls</h3>
        <p className="text-xs text-slate-400">Your recent call logs and duration usage</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/40 text-slate-400 text-[10px] uppercase tracking-wider font-semibold border-b border-slate-800/40">
              <th className="py-3 px-6">Caller / Recipient</th>
              <th className="py-3 px-6">Direction</th>
              <th className="py-3 px-6">Date & Time</th>
              <th className="py-3 px-6">Duration</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6">Recording</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
            {history.map((call) => {
              const callerId = typeof call.caller === 'object' ? call.caller?._id : call.caller;
              const isOutgoing = callerId === user.id;
              
              const contactNumber = isOutgoing 
                ? (typeof call.recipient === 'object' ? call.recipient?.phoneNumber : call.recipientPhoneNumber)
                : (typeof call.caller === 'object' ? call.caller?.phoneNumber : 'Unknown Caller');

              const hasRecording = recordingsList.includes(call._id);

              return (
                <tr key={call._id} className="hover:bg-slate-900/20 transition-colors">
                  {/* Phone Number */}
                  <td className="py-4 px-6 font-semibold text-slate-200">
                    {contactNumber}
                  </td>
                  
                  {/* Direction */}
                  <td className="py-4 px-6">
                    {isOutgoing ? (
                      <span className="flex items-center gap-1 text-xs text-sky-400">
                        <PhoneOutgoing size={12} /> Outgoing
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-purple-400">
                        <PhoneIncoming size={12} /> Incoming
                      </span>
                    )}
                  </td>
                  
                  {/* Date */}
                  <td className="py-4 px-6 text-slate-400 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(call.createdAt)}
                    </span>
                  </td>
                  
                  {/* Duration */}
                  <td className="py-4 px-6 font-mono text-xs">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-500" /> {formatDuration(call.duration)}
                    </span>
                  </td>
                  
                  {/* Status */}
                  <td className="py-4 px-6">
                    {getStatusBadge(call.status)}
                  </td>

                  {/* Recording */}
                  <td className="py-4 px-6">
                    {hasRecording ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePlayRecording(call._id)}
                          className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all border ${
                            playingCallId === call._id
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                        >
                          {playingCallId === call._id ? 'Pause' : 'Play'}
                        </button>
                        <button
                          onClick={() => handleDownloadRecording(call._id, contactNumber)}
                          className="px-3 py-1 text-xs rounded-lg font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDeleteRecording(call._id)}
                          className="px-3 py-1 text-xs rounded-lg font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 font-mono text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
