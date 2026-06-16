const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const { protect } = require('../middleware/auth');

// In-memory OTP cache: { phoneNumber: { otp, expiresAt } }
const otpCache = {};

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'voxconnect_super_secret_key_2026', {
    expiresIn: '30d'
  });
};

/**
 * @route   POST /api/auth/request-otp
 * @desc    Request a 6-digit OTP for a phone number
 * @access  Public
 */
router.post('/request-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // Basic phone number validation (digits and optional plus sign, length between 8-15)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanNumber = phoneNumber.replace(/[\s-()]/g, ''); // strip spaces, hyphens, parentheses
    
    if (!phoneRegex.test(cleanNumber)) {
      return res.status(400).json({ message: 'Invalid phone number format. Please use digits (e.g., +1234567890)' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL

    // Store in cache
    otpCache[cleanNumber] = { otp, expiresAt };

    // Print OTP in console with distinct styling
    console.log('\n=======================================');
    console.log(`[VoxConnect OTP Mock Service]`);
    console.log(`Phone: ${cleanNumber}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`Expires: ${new Date(expiresAt).toLocaleTimeString()}`);
    console.log('=======================================\n');

    // Return response. In development we return the OTP in the body for easy testing
    res.status(200).json({
      message: 'OTP sent successfully (mock service)',
      phoneNumber: cleanNumber,
      // For development speed, return it directly so the client can auto-fill or print it.
      mockOtp: otp 
    });
  } catch (error) {
    console.error('Request OTP Error:', error);
    res.status(500).json({ message: 'Server error generating OTP' });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and log in / register the user
 * @access  Public
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Phone number and OTP are required' });
    }

    const cleanNumber = phoneNumber.replace(/[\s-()]/g, '');
    const cachedRecord = otpCache[cleanNumber];

    // Check if OTP exists and is valid
    if (!cachedRecord) {
      // In development mode, let's also allow a universal code like '123456' as fallback
      if (otp !== '123456') {
        return res.status(400).json({ message: 'OTP not requested for this number. Use 123456 as universal fallback.' });
      }
    } else {
      const { otp: storedOtp, expiresAt } = cachedRecord;

      if (Date.now() > expiresAt) {
        delete otpCache[cleanNumber];
        return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
      }

      if (storedOtp !== otp && otp !== '123456') { // Allow universal OTP '123456' as well
        return res.status(400).json({ message: 'Invalid OTP code' });
      }

      // Valid OTP, delete from cache
      delete otpCache[cleanNumber];
    }

    // Get user or create if they don't exist
    let user = await userService.findByPhoneNumber(cleanNumber);
    if (!user) {
      user = await userService.createUser(cleanNumber);
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        trialsRemaining: user.trialsRemaining,
        totalMinutesUsed: user.totalMinutesUsed
      }
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Server error verifying OTP' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await userService.findById(req.user._id);
    res.status(200).json({
      id: user._id,
      phoneNumber: user.phoneNumber,
      trialsRemaining: user.trialsRemaining,
      totalMinutesUsed: user.totalMinutesUsed
    });
  } catch (error) {
    console.error('Fetch user data error:', error);
    res.status(500).json({ message: 'Server error fetching profile data' });
  }
});

module.exports = router;
