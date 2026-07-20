import bcrypt from 'bcrypt';
import db from '../config/db.js';
import { encrypt, decrypt } from '../config/encryption.js';
import { clearSettingCache, getSetting } from '../config/configResolver.js';

// Predefined configuration metadata structure
const SETTING_SCHEMAS = [
  // QuickBooks
  { key: 'QBO_ENVIRONMENT', category: 'quickbooks', isSecret: false, label: 'Environment', description: 'QuickBooks environment (sandbox or production)', options: ['sandbox', 'production'] },
  { key: 'QBO_CLIENT_ID', category: 'quickbooks', isSecret: true, label: 'Client ID', description: 'Intuit Developer OAuth 2.0 Client ID' },
  { key: 'QBO_CLIENT_SECRET', category: 'quickbooks', isSecret: true, label: 'Client Secret', description: 'Intuit Developer OAuth 2.0 Client Secret' },
  { key: 'QBO_REDIRECT_URI', category: 'quickbooks', isSecret: false, label: 'Redirect URI', description: 'OAuth callback URL configured in Intuit App Portal' },

  // Stripe
  { key: 'STRIPE_TEST_MODE', category: 'stripe', isSecret: false, label: 'Test Mode ($1.00 Charge)', description: 'When enabled, Stripe charges $1.00 for payment testing and updates contract totals to $1.00 across QuickBooks, Galt, and HubSpot.', options: ['false', 'true'] },
  { key: 'STRIPE_PUBLISHABLE_KEY', category: 'stripe', isSecret: false, label: 'Publishable Key', description: 'Stripe Publishable Key (pk_test_... or pk_live_...)' },
  { key: 'STRIPE_SECRET_KEY', category: 'stripe', isSecret: true, label: 'Secret Key', description: 'Stripe Secret Key (sk_test_... or sk_live_...)' },
  { key: 'STRIPE_WEBHOOK_SECRET', category: 'stripe', isSecret: true, label: 'Webhook Secret', description: 'Stripe Webhook Endpoint Secret (whsec_...)' },

  // HubSpot
  { key: 'HUBSPOT_API_KEY', category: 'hubspot', isSecret: true, label: 'Private App Access Token', description: 'HubSpot Private App Access Token (pat-na2-...)' },
  { key: 'HUBSPOT_ACCOUNT_ID', category: 'hubspot', isSecret: false, label: 'Portal / Account ID', description: 'HubSpot Hub ID / Account ID' },
  { key: 'HUBSPOT_PIPELINE_ID', category: 'hubspot', isSecret: false, label: 'Pipeline ID', description: 'HubSpot Deal Pipeline ID (defaults to "default")' },
  { key: 'HUBSPOT_OWNER_ID', category: 'hubspot', isSecret: false, label: 'Owner ID', description: 'HubSpot Owner User ID assigned to Deals (optional)' },

  // Galt API
  { key: 'GALT_API_BASE_URL', category: 'galt', isSecret: false, label: 'API Base URL', description: 'Galt Enterprises endpoint URL' },
  { key: 'GALT_USERNAME', category: 'galt', isSecret: false, label: 'Username', description: 'Galt API account username' },
  { key: 'GALT_PASSWORD', category: 'galt', isSecret: true, label: 'Password', description: 'Galt API account password' },
  { key: 'GALT_DEALER_NUMBER', category: 'galt', isSecret: false, label: 'Dealer Number', description: 'Galt Dealer account number' },

  // Email / SMTP
  { key: 'SMTP_HOST', category: 'email', isSecret: false, label: 'SMTP Server Host', description: 'Outgoing mail server host (e.g. smtp.gmail.com)' },
  { key: 'SMTP_PORT', category: 'email', isSecret: false, label: 'SMTP Port', description: 'SMTP port (587 or 465)' },
  { key: 'SMTP_USER', category: 'email', isSecret: false, label: 'SMTP Username / Email', description: 'SMTP authentication username' },
  { key: 'SMTP_PASS', category: 'email', isSecret: true, label: 'SMTP Password', description: 'SMTP authentication password / app password' },
  { key: 'EMAIL_FROM', category: 'email', isSecret: false, label: 'From Email Address', description: 'Default sender email address' }
];

/**
 * Helper to verify Admin password
 */
async function verifyUserPassword(userId, password) {
  if (!password) return false;
  const res = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (res.rows.length === 0) return false;
  return await bcrypt.compare(password, res.rows[0].password_hash);
}

/**
 * Mask secret string for safe frontend display
 */
function maskSecret(val) {
  if (!val) return '';
  if (val.length <= 8) return '••••••••';
  const prefix = val.substring(0, 4);
  const suffix = val.substring(val.length - 4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Verify Admin Password endpoint
 */
export const verifyPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'Password is required' });
  }

  try {
    const isValid = await verifyUserPassword(req.user.id, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[AdminSettings] Error verifying password:', err);
    return res.status(500).json({ message: 'Server error verifying password' });
  }
};

/**
 * Get all settings grouped by category (masked)
 */
export const getAdminSettings = async (req, res) => {
  try {
    const dbResult = await db.query('SELECT key, value, category, is_secret, updated_at FROM app_settings');
    const dbMap = {};
    dbResult.rows.forEach(r => {
      dbMap[r.key] = r;
    });

    const settings = [];

    for (const schema of SETTING_SCHEMAS) {
      const dbItem = dbMap[schema.key];
      let rawVal = '';
      let isCustom = false;
      let updatedAt = null;

      if (dbItem && dbItem.value) {
        rawVal = schema.isSecret ? decrypt(dbItem.value) : dbItem.value;
        isCustom = true;
        updatedAt = dbItem.updated_at;
      } else if (process.env[schema.key] !== undefined) {
        rawVal = process.env[schema.key];
      }

      settings.push({
        key: schema.key,
        label: schema.label,
        category: schema.category,
        description: schema.description,
        options: schema.options || null,
        isSecret: schema.isSecret,
        value: schema.isSecret ? maskSecret(rawVal) : rawVal,
        isSet: !!rawVal,
        isCustomDb: isCustom,
        updatedAt
      });
    }

    return res.json({ settings });
  } catch (err) {
    console.error('[AdminSettings] Error fetching settings:', err);
    return res.status(500).json({ message: 'Error fetching settings' });
  }
};

/**
 * Reveal full unmasked setting value after password check
 */
export const revealSetting = async (req, res) => {
  const { key, password } = req.body;
  if (!key || !password) {
    return res.status(400).json({ message: 'Key and password are required' });
  }

  try {
    const isValid = await verifyUserPassword(req.user.id, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password' });
    }

    const schema = SETTING_SCHEMAS.find(s => s.key === key);
    if (!schema) {
      return res.status(404).json({ message: 'Setting key not found' });
    }

    const rawVal = await getSetting(key);
    return res.json({ key, value: rawVal });
  } catch (err) {
    console.error('[AdminSettings] Error revealing setting:', err);
    return res.status(500).json({ message: 'Error revealing setting' });
  }
};

/**
 * Update app settings (requires password verification)
 */
export const updateAdminSettings = async (req, res) => {
  const { settings, password } = req.body;
  if (!settings || !Array.isArray(settings) || !password) {
    return res.status(400).json({ message: 'Settings array and admin password are required' });
  }

  try {
    const isValid = await verifyUserPassword(req.user.id, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password' });
    }

    for (const item of settings) {
      const schema = SETTING_SCHEMAS.find(s => s.key === item.key);
      if (!schema) continue;

      // Skip if value looks like a masked placeholder
      if (schema.isSecret && item.value && item.value.includes('••••••••')) {
        continue;
      }

      const valToStore = schema.isSecret ? encrypt(item.value || '') : (item.value || '');

      await db.query(`
        INSERT INTO app_settings (key, value, category, is_secret, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            category = EXCLUDED.category,
            is_secret = EXCLUDED.is_secret,
            updated_at = CURRENT_TIMESTAMP
      `, [schema.key, valToStore, schema.category, schema.isSecret]);
    }

    clearSettingCache();
    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err) {
    console.error('[AdminSettings] Error updating settings:', err);
    return res.status(500).json({ message: 'Failed to update settings' });
  }
};

/**
 * Disconnect QuickBooks (clears tokens from DB)
 */
export const disconnectQBO = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'Admin password is required to disconnect QuickBooks' });
  }

  try {
    const isValid = await verifyUserPassword(req.user.id, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect admin password' });
    }

    await db.query('DELETE FROM qbo_tokens');
    console.log('[QBO Controller] QuickBooks disconnected by admin.');
    return res.json({ success: true, message: 'QuickBooks connection removed successfully.' });
  } catch (err) {
    console.error('[AdminSettings] Error disconnecting QBO:', err);
    return res.status(500).json({ message: 'Failed to disconnect QuickBooks' });
  }
};

/**
 * Check overall integration system health and status for admin notice
 */
export const getSystemStatus = async (req, res) => {
  try {
    const qboRes = await db.query('SELECT id FROM qbo_tokens ORDER BY id DESC LIMIT 1');
    const qboConnected = qboRes.rows.length > 0;

    const stripePubKey = (await getSetting('STRIPE_PUBLISHABLE_KEY')) || process.env.VITE_STRIPE_PUB_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
    const stripeSecretKey = await getSetting('STRIPE_SECRET_KEY');
    const hubspotKey = await getSetting('HUBSPOT_API_KEY');
    const galtUrl = await getSetting('GALT_API_BASE_URL');
    const smtpHost = await getSetting('SMTP_HOST');

    const statusMap = {
      quickbooks: { name: 'QuickBooks', ok: qboConnected },
      stripe: { name: 'Stripe', ok: !!stripeSecretKey && !!stripePubKey },
      hubspot: { name: 'HubSpot', ok: !!hubspotKey },
      galt: { name: 'Galt Warranty', ok: !!galtUrl },
      email: { name: 'Email / SMTP', ok: !!smtpHost }
    };

    const unconfigured = Object.values(statusMap).filter(s => !s.ok).map(s => s.name);

    return res.json({
      allOk: unconfigured.length === 0,
      unconfiguredCount: unconfigured.length,
      unconfiguredServices: unconfigured,
      statusMap
    });
  } catch (err) {
    console.error('[AdminSettings] Error fetching system status:', err);
    return res.status(500).json({ message: 'Error checking system status' });
  }
};
