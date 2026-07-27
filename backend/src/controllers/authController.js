import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secretkey';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secretkey';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Technician Login
 *     description: Authenticates a technician and returns access + refresh tokens
 */
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Strictly compare hashed password — no plaintext fallback
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in DB
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @swagger
 * /api/refresh:
 *   post:
 *     summary: Refresh Access Token
 */
export const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    // Validate token against stored value in DB
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2',
      [decoded.id, token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = result.rows[0];
    const payload = { id: user.id, username: user.username, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(payload);

    res.json({ accessToken: newAccessToken, user: payload });
  } catch (err) {
    return res.status(401).json({ message: 'Refresh token expired or invalid' });
  }
};

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout
 */
export const logout = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(200).json({ message: 'Logged out' });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    await db.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [decoded.id]);
  } catch (_) {
    // Token already invalid, still respond success
  }

  res.json({ message: 'Logged out successfully' });
};

/**
 * Register a new user
 * POST /api/register
 */
export const register = async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  try {
    // Check if username or email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userRole = role || 'technician';

    const insertResult = await db.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, role, created_at`,
      [username, email, hash, userRole]
    );

    const newUser = insertResult.rows[0];
    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
};

/**
 * Initiate password reset (forgot password)
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email address is required' });
  }

  try {
    const userRes = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [email.trim()]
    );

    if (userRes.rows.length === 0) {
      // Return 200 for security to prevent user enumeration
      return res.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    const user = userRes.rows[0];
    if (!user.email) {
      return res.status(400).json({ message: 'No email address registered for this account.' });
    }

    // Generate secure random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour from now

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, expiry, user.id]
    );

    // Send reset email
    let emailInfo;
    try {
      emailInfo = await sendPasswordResetEmail(user.email, resetToken);
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr);
      return res.status(500).json({ message: 'Failed to send password reset email.' });
    }

    res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
      previewUrl: emailInfo?.previewUrl || null,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: 'Reset token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const result = await db.query(
      `SELECT * FROM users 
       WHERE reset_token = $1 
         AND reset_token_expiry IS NOT NULL 
         AND reset_token_expiry > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    const user = result.rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL 
       WHERE id = $2`,
      [hash, user.id]
    );

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

/**
 * Get all users (Admin only)
 * GET /api/admin/users
 */
export const getUsers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY id ASC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

/**
 * Delete user by ID (Admin only)
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  // Prevent self-deletion
  if (req.user && parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own admin account' });
  }

  try {
    const check = await db.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Unlink user from existing contracts to prevent foreign key constraint violation
    await db.query('UPDATE contracts SET technician_id = NULL WHERE technician_id = $1', [id]);

    // Delete user
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: `User ${check.rows[0].username} deleted successfully` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

