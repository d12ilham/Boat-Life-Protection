import express from 'express';
import jwt from 'jsonwebtoken';
import { login, refreshToken, logout } from '../controllers/authController.js';
import { initCustomerAndContract, signContract, getContract } from '../controllers/contractController.js';
import { createPaymentIntent, stripeWebhook, getStripeConfig } from '../controllers/paymentController.js';
import { getRate, submitApp, submitFullApp, getAppPdf, voidApp, checkVin, getStandardRate } from '../controllers/galtController.js';
import { connectQBO, callbackQBO, getQboStatus } from '../controllers/qboController.js';
import { 
  verifyPassword, 
  getAdminSettings, 
  revealSetting, 
  updateAdminSettings, 
  disconnectQBO,
  getSystemStatus
} from '../controllers/adminSettingsController.js';

const router = express.Router();

// ── Auth Middleware ────────────────────────────────────────────────────────────
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token expired or invalid' });
  }
};

export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    next();
  });
};

// ── Authentication Routes ─────────────────────────────────────────────────────
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// ── Protected Routes ──────────────────────────────────────────────────────────
router.post('/customer-init', requireAuth, initCustomerAndContract);
router.post('/contract-signature', requireAuth, signContract);
router.get('/contract/:id', requireAuth, getContract);
router.post('/create-payment-intent', requireAuth, createPaymentIntent);

// ── Galt API Routes ───────────────────────────────────────────────────────────
router.post('/galt/rate', requireAuth, getRate);
router.post('/galt/standard-rate', requireAuth, getStandardRate);
router.post('/galt/submit', requireAuth, submitFullApp); // NEW: orchestrated two-step flow
router.post('/galt/app', requireAuth, submitApp);        // direct passthrough (debug/legacy)
router.post('/galt/apppdf', requireAuth, getAppPdf);
router.post('/galt/void', requireAuth, voidApp);         // NEW: void endpoint
router.post('/galt/vincheck', requireAuth, checkVin);

// ── Stripe Webhook & Config (must be accessible for payments) ─────────────────
router.get('/stripe/config', getStripeConfig);
router.post('/webhook/stripe', stripeWebhook);

// -- QuickBooks Routes ----------------------------------------------------------
router.get('/qbo/connect', connectQBO);
router.get('/qbo/callback', callbackQBO);
router.get('/qbo/status', requireAuth, getQboStatus);

// -- Admin Settings Routes ------------------------------------------------------
router.post('/admin/verify-password', requireAdmin, verifyPassword);
router.get('/admin/settings', requireAdmin, getAdminSettings);
router.post('/admin/settings/reveal', requireAdmin, revealSetting);
router.post('/admin/settings', requireAdmin, updateAdminSettings);
router.post('/admin/qbo/disconnect', requireAdmin, disconnectQBO);
router.get('/admin/system-status', requireAdmin, getSystemStatus);

export default router;
