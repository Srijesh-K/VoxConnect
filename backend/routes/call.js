const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const callService = require('../services/callService');
const { protect } = require('../middleware/auth');

/**
 * @route   GET /api/call/history
 * @desc    Get call history for the current user
 * @access  Private
 */
router.get('/history', protect, async (req, res) => {
  try {
    const history = await callService.getCallHistory(req.user._id);
    res.status(200).json(history);
  } catch (error) {
    console.error('Fetch Call History Error:', error);
    res.status(500).json({ message: 'Server error retrieving call history' });
  }
});

/**
 * @route   POST /api/call/check-recipient
 * @desc    Check if recipient is registered and caller has trials remaining
 * @access  Private
 */
router.post('/check-recipient', protect, async (req, res) => {
  try {
    const { recipientPhoneNumber } = req.body;
    const callerId = req.user._id;

    if (!recipientPhoneNumber) {
      return res.status(400).json({ message: 'Recipient phone number is required' });
    }

    const cleanNumber = recipientPhoneNumber.replace(/[\s-()]/g, '');

    // 1. Check if caller has trials remaining
    const caller = await userService.findById(callerId);
    if (!caller || caller.trialsRemaining <= 0) {
      return res.status(400).json({ message: 'No call trials remaining. You cannot make any more calls.' });
    }

    // 2. Check if calling themselves
    if (caller.phoneNumber === cleanNumber) {
      return res.status(400).json({ message: 'You cannot make a call to your own number.' });
    }

    // 3. Check if recipient exists
    const recipient = await userService.findByPhoneNumber(cleanNumber);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient is not registered on VoxConnect yet.' });
    }

    res.status(200).json({
      message: 'Recipient is registered',
      recipient: {
        id: recipient._id,
        phoneNumber: recipient.phoneNumber
      }
    });
  } catch (error) {
    console.error('Check Recipient Error:', error);
    res.status(500).json({ message: 'Server error checking recipient' });
  }
});

module.exports = router;
