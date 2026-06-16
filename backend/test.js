const http = require('http');
const connectDB = require('./config/db');
const userService = require('./services/userService');
const callService = require('./services/callService');

// Set up environment variables
process.env.PORT = 5001;
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/voxconnect_test';
process.env.JWT_SECRET = 'test_secret_key_12345';
process.env.NODE_ENV = 'test';

// Import server
const express = require('express');
const app = express();
const server = http.createServer(app);
const cors = require('cors');
const authRoutes = require('./routes/auth');
const callRoutes = require('./routes/call');

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/call', callRoutes);

let jwtTokenUserA = '';
let userA_Id = '';
let userB_Id = '';

async function runTests() {
  console.log('--- Starting VoxConnect Backend Integration Tests ---');
  
  // 1. Connect database
  await connectDB();
  console.log(`Database initialized in ${global.isMockDB ? 'MOCK' : 'MONGODB'} mode.`);

  // 2. Start server
  await new Promise((resolve) => {
    server.listen(5001, () => {
      console.log('Test server listening on port 5001');
      resolve();
    });
  });

  try {
    // Test 1: Request OTP
    console.log('\n[Test 1] Requesting OTP...');
    const otpRes = await fetch('http://localhost:5001/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+1111111111' })
    });
    
    const otpData = await otpRes.json();
    if (otpRes.status !== 200 || !otpData.mockOtp) {
      throw new Error(`OTP request failed. Status: ${otpRes.status}, data: ${JSON.stringify(otpData)}`);
    }
    console.log(`✓ OTP Request successful. Received Mock OTP: ${otpData.mockOtp}`);

    // Test 2: Verify OTP
    console.log('\n[Test 2] Verifying OTP...');
    const verifyRes = await fetch('http://localhost:5001/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+1111111111', otp: otpData.mockOtp })
    });
    
    const verifyData = await verifyRes.json();
    if (verifyRes.status !== 200 || !verifyData.token) {
      throw new Error(`OTP Verification failed. Status: ${verifyRes.status}`);
    }
    jwtTokenUserA = verifyData.token;
    userA_Id = verifyData.user.id;
    console.log(`✓ OTP Verification successful. JWT obtained. Remaining trials: ${verifyData.user.trialsRemaining}`);

    if (verifyData.user.trialsRemaining !== 5) {
      throw new Error(`Expected initial trials to be 5, but got ${verifyData.user.trialsRemaining}`);
    }
    console.log('✓ Initial trials verified to be 5.');

    // Register User B (recipient)
    console.log('\n[Test 3] Registering Recipient User B...');
    const otpResB = await fetch('http://localhost:5001/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+2222222222' })
    });
    const otpDataB = await otpResB.json();
    const verifyResB = await fetch('http://localhost:5001/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+2222222222', otp: otpDataB.mockOtp })
    });
    const verifyDataB = await verifyResB.json();
    userB_Id = verifyDataB.user.id;
    console.log(`✓ Recipient User B registered. ID: ${userB_Id}`);

    // Test 4: Check Recipient
    console.log('\n[Test 4] Checking Recipient Status...');
    const checkRes = await fetch('http://localhost:5001/api/call/check-recipient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtTokenUserA}`
      },
      body: JSON.stringify({ recipientPhoneNumber: '+2222222222' })
    });
    const checkData = await checkRes.json();
    if (checkRes.status !== 200 || checkData.recipient.phoneNumber !== '+2222222222') {
      throw new Error(`Check recipient failed. Status: ${checkRes.status}, data: ${JSON.stringify(checkData)}`);
    }
    console.log('✓ Recipient exists status verified successfully.');

    // Test 5: Call billing logic (connected call trial billing)
    console.log('\n[Test 5] Simulating a connected call connection and hangup...');
    
    // Create Call record
    const callRecord = await callService.createCall({
      callerId: userA_Id,
      recipientId: userB_Id,
      recipientPhoneNumber: '+2222222222'
    });
    
    console.log('Call record created.');
    const callId = String(callRecord._id);
    
    // Connect Call
    await callService.connectCall(callId);
    console.log('Call connected.');
    
    // End Call after 60 seconds (1 minute)
    const callDuration = 60; // 60s
    await callService.endCall(callId, callDuration, 'completed');
    console.log(`Call hung up with duration: ${callDuration}s.`);
    
    // Deduct trials and add minutes
    await userService.decrementTrials(userA_Id);
    const updatedCaller = await userService.incrementMinutes(userA_Id, callDuration);
    
    console.log(`Updated Caller Profile -> Trials remaining: ${updatedCaller.trialsRemaining}, Total Minutes: ${updatedCaller.totalMinutesUsed}`);
    if (updatedCaller.trialsRemaining !== 4) {
      throw new Error(`Expected trials to be 4, but got ${updatedCaller.trialsRemaining}`);
    }
    if (updatedCaller.totalMinutesUsed !== 1) {
      throw new Error(`Expected total minutes to be 1, but got ${updatedCaller.totalMinutesUsed}`);
    }
    console.log('✓ Call trial decrement and duration increment logic verified.');

    // Test 6: Verify call history API
    console.log('\n[Test 6] Verifying Call History API endpoint...');
    const historyRes = await fetch('http://localhost:5001/api/call/history', {
      headers: { 'Authorization': `Bearer ${jwtTokenUserA}` }
    });
    const historyData = await historyRes.json();
    if (historyRes.status !== 200 || historyData.length === 0) {
      throw new Error(`Fetch history failed. Status: ${historyRes.status}`);
    }
    console.log(`✓ Call history returned ${historyData.length} records successfully.`);

    // Test 7: Block user when trials = 0
    console.log('\n[Test 7] Verifying call block when trials are exhausted...');
    
    // Manually set trials to 0
    if (global.isMockDB) {
      // Find in-memory user and update
      const user = await userService.findById(userA_Id);
      user.trialsRemaining = 0;
      // Overwrite in memory stores
      const userServiceModule = require('./services/userService');
      // Mocking helper is needed or we can call decrementTrials until it reaches 0
    }
    
    // To be database independent, we can just call decrementTrials 3 more times to reach 0
    await userService.decrementTrials(userA_Id);
    await userService.decrementTrials(userA_Id);
    await userService.decrementTrials(userA_Id);
    const exhaustedUser = await userService.decrementTrials(userA_Id);
    
    console.log(`Trials set to: ${exhaustedUser.trialsRemaining}`);

    // Call check-recipient again
    const checkBlockedRes = await fetch('http://localhost:5001/api/call/check-recipient', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtTokenUserA}`
      },
      body: JSON.stringify({ recipientPhoneNumber: '+2222222222' })
    });
    
    const checkBlockedData = await checkBlockedRes.json();
    if (checkBlockedRes.status !== 400) {
      throw new Error(`Expected status 400, but got ${checkBlockedRes.status}. Data: ${JSON.stringify(checkBlockedData)}`);
    }
    console.log(`✓ Verification Blocked. Message received: "${checkBlockedData.message}"`);

    console.log('\n=================================================');
    console.log('ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY!');
    console.log('=================================================');
    
  } catch (error) {
    console.error('\n❌ Test Failure:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up test server...');
    server.close();
    process.exit(process.exitCode || 0);
  }
}

runTests();
