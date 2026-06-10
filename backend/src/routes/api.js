import express from 'express';
import jwt from 'jsonwebtoken';
import { login, refreshToken, logout } from '../controllers/authController.js';
import { initCustomerAndContract, signContract, getContract } from '../controllers/contractController.js';
import { createPaymentIntent, stripeWebhook } from '../controllers/paymentController.js';
import { getRate, submitApp, submitFullApp, getAppPdf, voidApp, checkVin, getStandardRate } from '../controllers/galtController.js';
import { connectQBO, callbackQBO, getQboStatus } from '../controllers/qboController.js';

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

// ── Stripe Webhook (must be raw body, no auth middleware) ─────────────────────
router.post('/webhook/stripe', stripeWebhook);

// -- QuickBooks Routes ----------------------------------------------------------
router.get('/qbo/connect', connectQBO);
router.get('/qbo/callback', callbackQBO);
router.get('/qbo/status', requireAuth, getQboStatus);

export default router;
