require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/call');
const userService = require('./services/userService');
const callService = require('./services/callService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development flexibility
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Connect to Database
connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/call', callRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    database: global.isMockDB ? 'IN-MEMORY-MOCK' : 'MONGODB'
  });
});

// Socket.IO States
const onlineUsers = new Map(); // userId -> socketId
const socketToUser = new Map(); // socketId -> userId
const activeCalls = {}; // callId -> callSession object

// Helper to get socket ID for a user ID
const getUserSocketId = (userId) => onlineUsers.get(String(userId));

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // Register User
  socket.on('register', (userId) => {
    if (!userId) return;
    const strUserId = String(userId);
    onlineUsers.set(strUserId, socket.id);
    socketToUser.set(socket.id, strUserId);
    console.log(`User ${strUserId} registered at Socket ${socket.id}`);
    
    // Broadcast user online status
    io.emit('user-status-change', { userId: strUserId, status: 'online' });
  });

  // Check user status
  socket.on('check-online', (userId, callback) => {
    if (!userId) return callback(false);
    const isOnline = onlineUsers.has(String(userId));
    callback(isOnline);
  });

  // Call Request
  socket.on('call-user', async ({ recipientId, recipientPhoneNumber }) => {
    const callerId = socketToUser.get(socket.id);
    if (!callerId) {
      return socket.emit('call-error', { message: 'Authentication required' });
    }

    try {
      const caller = await userService.findById(callerId);
      if (!caller || caller.trialsRemaining <= 0) {
        return socket.emit('call-error', { message: 'No call trials remaining. You cannot place a call.' });
      }

      // Check if recipient is online
      const recipientSocketId = getUserSocketId(recipientId);
      if (!recipientSocketId) {
        return socket.emit('call-error', { message: 'User is currently offline' });
      }

      // Create call record in DB (status: 'failed' initially)
      const call = await callService.createCall({
        callerId,
        recipientId,
        recipientPhoneNumber
      });

      const callId = String(call._id);

      // Save in activeCalls
      activeCalls[callId] = {
        callId,
        callerId,
        callerSocketId: socket.id,
        callerPhoneNumber: caller.phoneNumber,
        recipientId,
        recipientSocketId,
        recipientPhoneNumber,
        status: 'ringing',
        startTime: null,
        timeoutId: null
      };

      // Emit incoming call to recipient
      io.to(recipientSocketId).emit('incoming-call', {
        callId,
        callerId,
        callerPhoneNumber: caller.phoneNumber
      });

      console.log(`Call Initiated: ${callId} from ${caller.phoneNumber} to ${recipientPhoneNumber}`);
    } catch (error) {
      console.error('Call User Error:', error);
      socket.emit('call-error', { message: 'Failed to initiate call due to server error' });
    }
  });

  // Accept Call
  socket.on('accept-call', async ({ callId }) => {
    const session = activeCalls[callId];
    if (!session) {
      return socket.emit('call-error', { message: 'Call session not found' });
    }

    try {
      // Connect Call in Database
      await callService.connectCall(callId);
      
      session.status = 'connected';
      session.startTime = Date.now();

      // Set maximum 5-minute (300,000 ms) server-side cap
      const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes
      session.timeoutId = setTimeout(() => {
        handleCallTimeout(callId);
      }, MAX_DURATION_MS);

      // Notify caller
      io.to(session.callerSocketId).emit('call-accepted', {
        callId,
        recipientSocketId: socket.id
      });

      console.log(`Call Connected: ${callId} started timeout of 5 mins`);
    } catch (error) {
      console.error('Accept Call Error:', error);
      socket.emit('call-error', { message: 'Failed to connect call' });
    }
  });

  // Reject Call
  socket.on('reject-call', async ({ callId }) => {
    const session = activeCalls[callId];
    if (!session) return;

    try {
      // Update Call DB record
      await callService.endCall(callId, 0, 'rejected');

      // Notify caller
      io.to(session.callerSocketId).emit('call-rejected', { callId });
      
      delete activeCalls[callId];
      console.log(`Call Rejected: ${callId}`);
    } catch (error) {
      console.error('Reject Call Error:', error);
    }
  });

  // Hangup Call
  socket.on('hangup', async ({ callId }) => {
    await handleCallHangup(callId, socket.id);
  });

  // WebRTC Signaling Relays
  socket.on('webrtc-offer', ({ toSocketId, offer, callId }) => {
    io.to(toSocketId).emit('webrtc-offer', {
      fromSocketId: socket.id,
      offer,
      callId
    });
  });

  socket.on('webrtc-answer', ({ toSocketId, answer, callId }) => {
    io.to(toSocketId).emit('webrtc-answer', {
      fromSocketId: socket.id,
      answer,
      callId
    });
  });

  socket.on('webrtc-ice-candidate', ({ toSocketId, candidate, callId }) => {
    io.to(toSocketId).emit('webrtc-ice-candidate', {
      fromSocketId: socket.id,
      candidate,
      callId
    });
  });

  // Handle Disconnect
  socket.on('disconnect', async () => {
    console.log(`Socket Disconnected: ${socket.id}`);
    const userId = socketToUser.get(socket.id);

    if (userId) {
      const strUserId = String(userId);
      onlineUsers.delete(strUserId);
      socketToUser.delete(socket.id);

      // Clean up user status
      io.emit('user-status-change', { userId: strUserId, status: 'offline' });

      // Clean up active calls this user was part of
      for (const callId in activeCalls) {
        const session = activeCalls[callId];
        if (session.callerSocketId === socket.id || session.recipientSocketId === socket.id) {
          console.log(`Disconnect cleanup: Hangup call ${callId}`);
          await handleCallHangup(callId, socket.id);
        }
      }
    }
  });
});

// Helper to handle standard hangup
async function handleCallHangup(callId, hangupSocketId) {
  const session = activeCalls[callId];
  if (!session) return;

  // Clear timeout
  if (session.timeoutId) {
    clearTimeout(session.timeoutId);
  }

  try {
    let durationSeconds = 0;
    let finalStatus = 'failed';

    if (session.status === 'connected' && session.startTime) {
      durationSeconds = Math.round((Date.now() - session.startTime) / 1000);
      // Ensure the cap is exactly 5 minutes (300 seconds) if client lags
      if (durationSeconds > 300) {
        durationSeconds = 300;
      }
      finalStatus = 'completed';
    } else {
      // If hung up while ringing
      finalStatus = hangupSocketId === session.callerSocketId ? 'missed' : 'rejected';
    }

    // Save Call End State
    await callService.endCall(callId, durationSeconds, finalStatus);

    // If call connected, caller consumes 1 trial and gets duration added
    if (session.status === 'connected' && durationSeconds > 0) {
      await userService.decrementTrials(session.callerId);
      await userService.incrementMinutes(session.callerId, durationSeconds);
    }

    // Notify the other peer
    const otherSocketId = hangupSocketId === session.callerSocketId 
      ? session.recipientSocketId 
      : session.callerSocketId;

    if (otherSocketId) {
      io.to(otherSocketId).emit('call-ended', { callId, reason: 'hangup' });
    }

    // Emit updates to both users to refresh stats on dashboard
    emitStatsUpdate(session.callerId);
    emitStatsUpdate(session.recipientId);

    console.log(`Call Cleaned Up: ${callId}. Duration: ${durationSeconds}s, Status: ${finalStatus}`);
  } catch (error) {
    console.error('Error during call hangup cleanup:', error);
  } finally {
    delete activeCalls[callId];
  }
}

// Helper to handle 5-minute timeout
async function handleCallTimeout(callId) {
  const session = activeCalls[callId];
  if (!session) return;

  console.log(`[TIMEOUT CAP REACHED] Forcing call disconnect for: ${callId}`);

  try {
    const durationSeconds = 300; // Exact 5 minutes
    
    // Save call state
    await callService.endCall(callId, durationSeconds, 'completed');

    // Decrement trials and increment minutes
    await userService.decrementTrials(session.callerId);
    await userService.incrementMinutes(session.callerId, durationSeconds);

    // Notify both sockets of timeout
    if (session.callerSocketId) {
      io.to(session.callerSocketId).emit('call-timeout', { callId });
    }
    if (session.recipientSocketId) {
      io.to(session.recipientSocketId).emit('call-timeout', { callId });
    }

    // Update stats
    emitStatsUpdate(session.callerId);
    emitStatsUpdate(session.recipientId);

  } catch (error) {
    console.error('Error during call timeout handling:', error);
  } finally {
    delete activeCalls[callId];
  }
}

// Send updated profile details to online client to automatically update UI
async function emitStatsUpdate(userId) {
  const socketId = getUserSocketId(userId);
  if (!socketId) return;

  try {
    const user = await userService.findById(userId);
    if (user) {
      io.to(socketId).emit('stats-update', {
        trialsRemaining: user.trialsRemaining,
        totalMinutesUsed: user.totalMinutesUsed
      });
    }
  } catch (error) {
    console.error('Error emitting stats update:', error);
  }
}

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
