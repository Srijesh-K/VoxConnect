const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const callService = require('../services/callService');
const configService = require('../services/configService');

// Admin Authorization Middleware
const protectAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_ACCESS_KEY || 'voxconnect_admin_key_2026';

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({ message: 'Unauthorized: Invalid admin access key' });
  }
  next();
};

/**
 * @route   GET /api/admin/config
 * @desc    Fetch global settings config
 * @access  Private Admin
 */
router.get('/config', protectAdmin, async (req, res) => {
  try {
    const config = await configService.getConfig();
    res.status(200).json(config);
  } catch (error) {
    console.error('Fetch Admin Config Error:', error);
    res.status(500).json({ message: 'Server error fetching configuration' });
  }
});

/**
 * @route   POST /api/admin/config
 * @desc    Update global settings config
 * @access  Private Admin
 */
router.post('/config', protectAdmin, async (req, res) => {
  try {
    const { maxCallDurationSeconds, defaultTrialsCount } = req.body;
    const updated = await configService.updateConfig({
      maxCallDurationSeconds,
      defaultTrialsCount
    });
    res.status(200).json(updated);
  } catch (error) {
    console.error('Update Admin Config Error:', error);
    res.status(500).json({ message: 'Server error updating configuration' });
  }
});

/**
 * @route   GET /api/admin/users
 * @desc    Fetch all registered users
 * @access  Private Admin
 */
router.get('/users', protectAdmin, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error('Fetch Admin Users Error:', error);
    res.status(500).json({ message: 'Server error fetching user list' });
  }
});

/**
 * @route   POST /api/admin/users/:userId/trials
 * @desc    Set specific user remaining trials
 * @access  Private Admin
 */
router.post('/users/:userId/trials', protectAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { trialsRemaining } = req.body;

    if (trialsRemaining === undefined || isNaN(parseInt(trialsRemaining))) {
      return res.status(400).json({ message: 'Valid trialsRemaining value is required' });
    }

    const updated = await userService.setTrials(userId, trialsRemaining);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Update User Trials Error:', error);
    res.status(500).json({ message: 'Server error updating trials count' });
  }
});

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete a registered user
 * @access  Private Admin
 */
router.delete('/users/:userId', protectAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const deleted = await userService.deleteUser(userId);
    if (!deleted) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully', user: deleted });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ message: 'Server error deleting user profile' });
  }
});

/**
 * @route   GET /api/admin/calls
 * @desc    Fetch all system call logs
 * @access  Private Admin
 */
router.get('/calls', protectAdmin, async (req, res) => {
  try {
    const calls = await callService.getAllCalls();
    res.status(200).json(calls);
  } catch (error) {
    console.error('Fetch Admin Calls Error:', error);
    res.status(500).json({ message: 'Server error fetching global call history' });
  }
});

module.exports = router;
