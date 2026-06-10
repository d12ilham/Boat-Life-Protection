import db from '../config/db.js';

export const connectQBO = (req, res) => {
  const clientId = process.env.QBO_CLIENT_ID;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const env = process.env.QBO_ENVIRONMENT || 'sandbox';

  if (!clientId || !redirectUri) {
    return res.status(500).send('QuickBooks Client ID or Redirect URI is not configured.');
  }

  // QuickBooks authorization endpoint
  const authUrl = `https://appcenter.intuit.com/connect/oauth2` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=com.intuit.quickbooks.accounting` +
    `&state=qbo_auth_state`;

  console.log(`[QBO Controller] Redirecting admin to QuickBooks authorization...`);
  res.redirect(authUrl);
};

export const callbackQBO = async (req, res) => {
  console.log(`[QBO Controller] Received callback from QuickBooks...`);
  const { code, realmId } = req.query;

  if (!code || !realmId) {
    return res.status(400).send('Authorization code or Realm ID is missing.');
  }

  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).send('QuickBooks API variables are not fully configured.');
  }

  const credentials = `${clientId}:${clientSecret}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

  try {
    const response = await fetch('https://oauth.platform.intuit.com/oauth5/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to exchange authorization code: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Clear old tokens and save the new ones
    await db.query('DELETE FROM qbo_tokens');
    await db.query(`
      INSERT INTO qbo_tokens (access_token, refresh_token, realm_id, expires_at)
      VALUES ($1, $2, $3, $4)
    `, [data.access_token, data.refresh_token, realmId, expiresAt]);

    console.log(`[QBO Controller] Successfully connected to QuickBooks. Realm ID: ${realmId}`);
    res.redirect(`${frontendUrl}/?qbo_connection=success`);
  } catch (err) {
    console.error('[QBO Controller] Error in OAuth callback:', err);
    res.redirect(`${frontendUrl}/?qbo_connection=error&message=${encodeURIComponent(err.message)}`);
  }
};

export const getQboStatus = async (req, res) => {
  try {
    const result = await db.query('SELECT realm_id, expires_at FROM qbo_tokens ORDER BY id DESC LIMIT 1');
    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }
    
    const { realm_id, expires_at } = result.rows[0];
    const isTokenExpired = new Date(expires_at) <= new Date();

    return res.json({
      connected: true,
      realmId: realm_id,
      tokenExpired: isTokenExpired
    });
  } catch (err) {
    console.error('[QBO Controller] Error fetching QBO status:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};