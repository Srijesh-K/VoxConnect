import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Header from './Header';
import CallHistory from './CallHistory';
import ActiveCall from './ActiveCall';
import IncomingCallModal from './IncomingCallModal';
import { Phone, Search, AlertCircle, AlertTriangle, Settings } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const iceServersConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function Dashboard({ onAdminClick }) {
  const { user, token, refreshProfile, updateStats } = useAuth();
  
  // Call State
  const [recipientNumber, setRecipientNumber] = useState('');
  const [callSession, setCallSession] = useState(null); // { callId, status: 'ringing'|'connected', role: 'caller'|'recipient', recipientPhoneNumber, callerPhoneNumber }
  const [connectionState, setConnectionState] = useState('new');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // References for WebRTC and Sockets
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerSocketIdRef = useRef(null); // socketId of the other peer

  // Fetch Call History
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/call/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // 1. Initialize Sockets
  useEffect(() => {
    if (!user || !token) return;

    // Connect socket
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    // Register user
    socket.emit('register', user.id);

    // Initial history fetch
    fetchHistory();

    // Listen for Incoming Calls
    socket.on('incoming-call', ({ callId, callerId, callerPhoneNumber }) => {
      // If user is already in a call, reject it automatically
      if (pcRef.current || callSession) {
        socket.emit('reject-call', { callId });
        return;
      }

      setCallSession({
        callId,
        status: 'ringing',
        role: 'recipient',
        callerPhoneNumber
      });
    });

    // Listen for Call Accepted (Caller Side)
    socket.on('call-accepted', async ({ callId, recipientSocketId }) => {
      peerSocketIdRef.current = recipientSocketId;
      setCallSession(prev => prev ? { ...prev, status: 'connected' } : null);
      
      // Start WebRTC Negotiation
      try {
        await initiateWebRTCCall(recipientSocketId, callId);
      } catch (err) {
        console.error('WebRTC Initiation Failed:', err);
        handleHangup(callId);
      }
    });

    // Listen for Call Rejected (Caller Side)
    socket.on('call-rejected', ({ callId }) => {
      setError('Call rejected by the recipient');
      cleanupCallState();
      fetchHistory();
      refreshProfile();
    });

    // Listen for WebRTC Offer (Recipient Side)
    socket.on('webrtc-offer', async ({ fromSocketId, offer, callId }) => {
      peerSocketIdRef.current = fromSocketId;
      try {
        await handleOfferReceived(fromSocketId, offer, callId);
      } catch (err) {
        console.error('Error answering offer:', err);
        handleHangup(callId);
      }
    });

    // Listen for WebRTC Answer (Caller Side)
    socket.on('webrtc-answer', async ({ answer }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error setting remote answer description:', err);
        }
      }
    });

    // Listen for ICE Candidates
    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    // Listen for Call Ended (from other side hanging up)
    socket.on('call-ended', ({ callId, reason }) => {
      console.log(`Call ${callId} ended. Reason: ${reason}`);
      cleanupCallState();
      fetchHistory();
      refreshProfile();
    });

    // Listen for Call Timeout (5 min limit reached)
    socket.on('call-timeout', ({ callId }) => {
      console.log(`Call ${callId} timed out.`);
      alert('Maximum call limit of 5 minutes reached. Call automatically disconnected.');
      cleanupCallState();
      fetchHistory();
      refreshProfile();
    });

    // Listen for real-time trials/minutes changes from the server
    socket.on('stats-update', (stats) => {
      updateStats(stats);
    });

    // Listen for Call Errors
    socket.on('call-error', ({ message }) => {
      setError(message);
      cleanupCallState();
      fetchHistory();
      refreshProfile();
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
      cleanupCallState();
    };
  }, [user, token]);

  // Clean up Peer Connections & Streams
  const cleanupCallState = () => {
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop audio player
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    setCallSession(null);
    setConnectionState('new');
    setLoading(false);
    peerSocketIdRef.current = null;
  };

  // 2. Initiate Call (Caller Side)
  const handleMakeCall = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!recipientNumber) {
      setError('Please enter a recipient phone number');
      setLoading(false);
      return;
    }

    if (user.trialsRemaining <= 0) {
      setError('No trials left. You cannot make any more free calls.');
      setLoading(false);
      return;
    }

    try {
      // Step A: Validate recipient availability via API
      const res = await fetch(`${API_URL}/api/call/check-recipient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientPhoneNumber: recipientNumber })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to connect');
      }

      // Step B: Send signaling request via Socket.IO
      socketRef.current.emit('call-user', {
        recipientId: data.recipient.id,
        recipientPhoneNumber: data.recipient.phoneNumber
      });

      setCallSession({
        status: 'ringing',
        role: 'caller',
        recipientPhoneNumber: data.recipient.phoneNumber
      });

    } catch (err) {
      setError(err.message || 'Call initiation failed');
      setLoading(false);
    }
  };

  // WebRTC Caller Logic
  const initiateWebRTCCall = async (recipientSocketId, callId) => {
    // 1. Get local audio stream
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Microphone access error (caller):', err);
      alert('Microphone permission is required to start a call.');
      handleHangup(callId);
      return;
    }

    // 2. Real Peer Connection
    const pc = new RTCPeerConnection(iceServersConfig);
    pcRef.current = pc;

    // Track connection state
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // Send local tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', {
          toSocketId: recipientSocketId,
          candidate: event.candidate,
          callId
        });
      }
    };

    // Play Remote Audio Stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteAudioRef.current) {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(e => console.error('Audio play failed:', e));
        remoteAudioRef.current = audio;
      }
    };

    // 3. Create & send Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('webrtc-offer', {
      toSocketId: recipientSocketId,
      offer,
      callId
    });
  };

  // 3. Accept Call (Recipient Side)
  const handleAcceptCall = async () => {
    if (!callSession) return;
    setLoading(true);

    // Accept through Socket.IO
    socketRef.current.emit('accept-call', { callId: callSession.callId });
    setCallSession(prev => prev ? { ...prev, status: 'connected' } : null);
  };

  // WebRTC Recipient Logic (On Offer Received)
  const handleOfferReceived = async (callerSocketId, offer, callId) => {
    // 1. Get local mic stream
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Microphone access error (recipient):', err);
      alert('Microphone permission is required to accept this call.');
      handleHangup(callId);
      return;
    }

    // 2. Create peer connection
    const pc = new RTCPeerConnection(iceServersConfig);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // Add local tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle ICE Candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', {
          toSocketId: callerSocketId,
          candidate: event.candidate,
          callId
        });
      }
    };

    // Play Remote Audio Stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteAudioRef.current) {
        const audio = new Audio();
        audio.srcObject = remoteStream;
        audio.play().catch(e => console.error('Audio play failed:', e));
        remoteAudioRef.current = audio;
      }
    };

    // 3. Set remote offer & send Answer
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('webrtc-answer', {
      toSocketId: callerSocketId,
      answer,
      callId
    });
    setLoading(false);
  };

  // 4. Reject Call (Recipient Side)
  const handleRejectCall = () => {
    if (!callSession) return;
    socketRef.current.emit('reject-call', { callId: callSession.callId });
    cleanupCallState();
    fetchHistory();
    refreshProfile();
  };

  // 5. Hang up Call (Either Side)
  const handleHangup = (customCallId = null) => {
    const callId = customCallId || (callSession && callSession.callId);
    if (callId && socketRef.current) {
      socketRef.current.emit('hangup', { callId });
    }
    cleanupCallState();
    fetchHistory();
    refreshProfile();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-12">
      <Header onAdminClick={onAdminClick} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 w-full flex-grow space-y-8 relative">
        {/* Call Panel Glassmorphism Card */}
        <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          {/* Subtle decoration glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl"></div>

          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-100 mb-2">Initiate Web Call</h2>
            <p className="text-xs text-slate-400 mb-6">
              Enter the recipient's phone number to connect instantly over WebRTC. Both users must be registered and online.
            </p>

            {/* Error alerts */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Trials Alert if 0 */}
            {user.trialsRemaining === 0 && (
              <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2 animate-pulse">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>You have used all 5 free trials. Please recharge to make further calls.</span>
              </div>
            )}

            {/* Dialer Form */}
            <form onSubmit={handleMakeCall} className="space-y-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                  <Search size={18} />
                </span>
                <input
                  type="tel"
                  placeholder="Recipient's phone (e.g. +919999999999)"
                  value={recipientNumber}
                  onChange={(e) => setRecipientNumber(e.target.value)}
                  disabled={loading || user.trialsRemaining === 0}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-slate-700/50 rounded-2xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-slate-100 placeholder-slate-500 transition-all font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || user.trialsRemaining === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all disabled:opacity-30"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Phone size={16} /> Place Voice Call
                  </>
                )}
              </button>
            </form>

            {/* Quick Link to Admin Panel */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
              <button
                onClick={onAdminClick}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold transition-colors focus:outline-none"
              >
                <Settings size={12} /> Open Admin Control Center
              </button>
            </div>
          </div>
        </div>

        {/* Call History Card */}
        <CallHistory history={history} />
      </main>

      {/* Active Call UI overlay */}
      {callSession && (
        <ActiveCall
          callSession={callSession}
          onHangup={() => handleHangup()}
          connectionState={connectionState}
        />
      )}

      {/* Incoming Call popup */}
      {callSession && callSession.role === 'recipient' && callSession.status === 'ringing' && (
        <IncomingCallModal
          callerPhoneNumber={callSession.callerPhoneNumber}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
    </div>
  );
}
