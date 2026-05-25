import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 *       401:
 *         description: Invalid credentials
 */
export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Strictly compare hashed password — no plaintext fallback
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { id: user.id, username: user.username, role: user.role };
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
      user: { id: user.id, username: user.username, role: user.role },
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
 *     description: Issues a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token issued
 *       401:
 *         description: Invalid or expired refresh token
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
    const payload = { id: user.id, username: user.username, role: user.role };
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
 *     description: Invalidates the refresh token for this user
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
