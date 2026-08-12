const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'educopilot_super_secret_jwt_key_2026_secure',
    { expiresIn: '30d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new student or professor
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, gradeOrClass, subjects } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: 'Please provide all required fields (name, email, password, role).' });
    }

    if (!['student', 'professor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either student or professor.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      gradeOrClass: gradeOrClass || '',
      subjects: Array.isArray(subjects)
        ? subjects
        : typeof subjects === 'string' && subjects.trim()
        ? subjects.split(',').map((s) => s.trim())
        : ['Computer Science', 'Mathematics'],
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      gradeOrClass: user.gradeOrClass,
      subjects: user.subjects,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({ error: error.message || 'Server error during registration.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  try {
    const { email, password, expectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: `Access denied. This account is registered as a ${user.role}, not a ${expectedRole}.`,
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      gradeOrClass: user.gradeOrClass,
      subjects: user.subjects,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: error.message || 'Server error during login.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

module.exports = router;
