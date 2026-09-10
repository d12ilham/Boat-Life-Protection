import db from '../config/db.js';
import { getSetting } from '../config/configResolver.js';

let cachedEndpoints = null;
let cacheExpiry = 0;

/**
 * Helper to capture and log Intuit Transaction ID header (intuit_tid)
 */
export const logIntuitTid = (res, contextName = 'QBO API') => {
  if (!res || !res.headers) return;
  const tid = res.headers.get('intuit_tid') || res.headers.get('intuit-tid');
  if (tid) {
    console.log(`[QBO Service] Intuit Transaction ID (${contextName}): ${tid}`);
  }
};

export const getDiscoveryEndpoints = async () => {
  // Cache endpoints for 1 hour to prevent redundant network requests
  if (cachedEndpoints && Date.now() < cacheExpiry) {
    return cachedEndpoints;
  }

  const env = await getSetting('QBO_ENVIRONMENT', 'sandbox');
  const discoveryUrl = env === 'production'
    ? 'https://developer.intuit.com/.well-known/openid_configuration'
    : 'https://developer.intuit.com/.well-known/openid_sandbox_configuration';

  console.log(`[QBO Service] Fetching Discovery Document from: ${discoveryUrl}`);
  try {
    const res = await fetch(discoveryUrl);
    logIntuitTid(res, 'Discovery Document');
    if (res.ok) {
      const config = await res.json();
      if (config.authorization_endpoint && config.token_endpoint) {
        cachedEndpoints = {
          authorizationEndpoint: config.authorization_endpoint,
          tokenEndpoint: config.token_endpoint
        };
        cacheExpiry = Date.now() + 60 * 60 * 1000; // 1 hour cache
        console.log('[QBO Service] Successfully retrieved endpoints dynamically from Discovery Document.');
        return cachedEndpoints;
      }
    }
    console.warn(`[QBO Service] Discovery response not OK (${res.status}). Using fallback static endpoints.`);
  } catch (err) {
    console.error('[QBO Service] Error fetching QuickBooks Discovery Document. Using fallback static endpoints:', err.message);
  }

  // Fallback endpoints
  return {
    authorizationEndpoint: 'https://appcenter.intuit.com/connect/oauth2',
    tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
  };
};

const getQboBaseUrl = async () => {
  const env = await getSetting('QBO_ENVIRONMENT', 'sandbox');
  return env === 'production' 
    ? 'https://quickbooks.api.intuit.com' 
    : 'https://sandbox-quickbooks.api.intuit.com';
};

/**
 * Exchange refresh token for a new access token and update the database.
 */
export const refreshQboToken = async (currentRefreshToken) => {
  console.log('[QBO Service] Refreshing QuickBooks access token...');
  const clientId = await getSetting('QBO_CLIENT_ID');
  const clientSecret = await getSetting('QBO_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks Client ID or Client Secret is missing in settings.');
  }

  const credentials = `${clientId}:${clientSecret}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

  const { tokenEndpoint } = await getDiscoveryEndpoints();
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': authHeader,
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken
    })
  });

  logIntuitTid(response, 'Token Refresh');

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh QuickBooks token: ${response.statusText} - ${errText}`);
  }

  const data = await response.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update token in database
  await db.query(`
    UPDATE qbo_tokens
    SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM qbo_tokens ORDER BY id DESC LIMIT 1)
  `, [data.access_token, data.refresh_token, expiresAt]);

  console.log('[QBO Service] QuickBooks access token refreshed successfully.');
  return data.access_token;
};

/**
 * Gets a valid access token. Handles auto-refresh if token is expired.
 */
export const getValidQboToken = async () => {
  const result = await db.query('SELECT * FROM qbo_tokens ORDER BY id DESC LIMIT 1');
  if (result.rows.length === 0) {
    return null;
  }

  const { access_token, refresh_token, realm_id, expires_at } = result.rows[0];
  
  // Refresh if expired or expiring within 5 minutes
  if (new Date(expires_at) <= new Date(Date.now() + 5 * 60 * 1000)) {
    try {
      const newAccessToken = await refreshQboToken(refresh_token);
      return { accessToken: newAccessToken, realmId: realm_id };
    } catch (err) {
      console.error('[QBO Service] Auto-refresh of token failed:', err);
      throw err;
    }
  }

  return { accessToken: access_token, realmId: realm_id };
};

/**
 * Search for a customer by email in QBO. If not found, create a new one.
 */
const getOrCreateQboCustomer = async (accessToken, realmId, customer) => {
  const baseUrl = await getQboBaseUrl();
  const email = (customer.email || '').trim();
  
  if (!email) {
    throw new Error('Customer email is required for QuickBooks synchronization.');
  }

  // 1. Search by PrimaryEmailAddr
  const query = `select * from Customer where PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`;
  const searchUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`QBO Customer Query failed: ${searchRes.statusText} - ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.QueryResponse && searchData.QueryResponse.Customer && searchData.QueryResponse.Customer.length > 0) {
    console.log(`[QBO Service] Found existing QBO customer ID by email: ${searchData.QueryResponse.Customer[0].Id}`);
    return searchData.QueryResponse.Customer[0].Id;
  }

  const rawDisplayName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || 'Walk-In Customer';

  // 2. Check if an existing customer has this exact DisplayName
  try {
    const nameQuery = `select * from Customer where DisplayName = '${rawDisplayName.replace(/'/g, "\\'")}'`;
    const nameSearchUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(nameQuery)}&minorversion=75`;
    const nameSearchRes = await fetch(nameSearchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (nameSearchRes.ok) {
      const nameData = await nameSearchRes.json();
      const existingCust = nameData.QueryResponse?.Customer?.[0];
      if (existingCust) {
        const existingEmail = (existingCust.PrimaryEmailAddr?.Address || '').trim();
        const existingPhone = (existingCust.PrimaryPhone?.FreeFormNumber || '').replace(/\D/g, '');
        const currentPhone = (customer.home_phone || customer.phone || '').replace(/\D/g, '');

        // If existing record has no email or phone matches, reuse existing QBO customer
        if (!existingEmail || (currentPhone && existingPhone && existingPhone === currentPhone)) {
          console.log(`[QBO Service] Found existing QBO customer matching name '${rawDisplayName}' with empty or matching contact details (ID: ${existingCust.Id}). Reusing.`);
          return existingCust.Id;
        }
      }
    }
  } catch (nameErr) {
    console.warn(`[QBO Service] Warning checking existing customer by name:`, nameErr.message);
  }

  // 3. Helper to attempt creating a customer with a given DisplayName
  const tryCreateCustomer = async (displayNameToUse) => {
    const createUrl = `${baseUrl}/v3/company/${realmId}/customer?minorversion=75`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        DisplayName: displayNameToUse,
        GivenName: customer.first_name || '',
        FamilyName: customer.last_name || '',
        PrimaryEmailAddr: {
          Address: email
        },
        PrimaryPhone: {
          FreeFormNumber: customer.home_phone || customer.phone || ''
        },
        BillAddr: {
          Line1: customer.street_address || customer.address || '',
          City: customer.city || '',
          CountrySubDivisionCode: customer.state || '',
          PostalCode: customer.zip_code || ''
        }
      })
    });

    const rawText = await createRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = { rawText };
    }
    return { ok: createRes.ok, status: createRes.status, data, rawText };
  };

  // 4. Attempt creation with standard name
  console.log(`[QBO Service] Creating new customer in QBO for: ${rawDisplayName}`);
  let result = await tryCreateCustomer(rawDisplayName.slice(0, 100));

  // 5. If duplicate name exists (Error 6240), differentiate DisplayName and retry
  if (!result.ok && result.rawText && (result.rawText.includes('6240') || result.rawText.includes('Duplicate Name Exists'))) {
    const emailSuffix = `(${email})`;
    const maxLen1 = Math.max(10, 100 - emailSuffix.length - 1);
    const nameWithEmail = `${rawDisplayName.slice(0, maxLen1)} ${emailSuffix}`.trim();

    console.warn(`[QBO Service] Name '${rawDisplayName}' already exists in QBO (Error 6240). Retrying with '${nameWithEmail}'`);
    result = await tryCreateCustomer(nameWithEmail);

    if (!result.ok && result.rawText && (result.rawText.includes('6240') || result.rawText.includes('Duplicate Name Exists'))) {
      const idSuffix = `(#${customer.id || Date.now().toString().slice(-4)})`;
      const maxLen2 = Math.max(10, 100 - idSuffix.length - 1);
      const nameWithId = `${rawDisplayName.slice(0, maxLen2)} ${idSuffix}`.trim();

      console.warn(`[QBO Service] Retrying with unique ID suffix: '${nameWithId}'`);
      result = await tryCreateCustomer(nameWithId);
    }
  }

  if (!result.ok) {
    throw new Error(`Failed to create QBO Customer: ${result.status} - ${result.rawText}`);
  }

  console.log(`[QBO Service] Created new QBO customer with ID: ${result.data.Customer.Id}`);
  return result.data.Customer.Id;
};

/**
 * Helper to get a revenue account for item creation fallback.
 */
const getIncomeAccountRef = async (accessToken, realmId) => {
  const baseUrl = await getQboBaseUrl();
  const query = `select * from Account where Classification = 'Revenue'`;
  const url = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to query QBO Accounts for item creation fallback.`);
  }

  const data = await res.json();
  if (data.QueryResponse && data.QueryResponse.Account && data.QueryResponse.Account.length > 0) {
    return {
      value: data.QueryResponse.Account[0].Id,
      name: data.QueryResponse.Account[0].Name
    };
  }

  // Fallback if no specific revenue account query returns data
  return {
    value: '1',
    name: 'Sales'
  };
};

/**
 * Search for an Item in QBO by service plan name. If not found, create a new Service item.
 */
const getOrCreateQboItem = async (accessToken, realmId, planName) => {
  const baseUrl = await getQboBaseUrl();
  const cleanPlanName = (planName || 'Boat Lift Service Contract').trim();

  // Search by Item Name
  const query = `select * from Item where Name = '${cleanPlanName.replace(/'/g, "\\'")}'`;
  const searchUrl = `${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`QBO Item Query failed: ${searchRes.statusText} - ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.QueryResponse && searchData.QueryResponse.Item && searchData.QueryResponse.Item.length > 0) {
    console.log(`[QBO Service] Found existing QBO item: ${cleanPlanName} (ID: ${searchData.QueryResponse.Item[0].Id})`);
    return {
      value: searchData.QueryResponse.Item[0].Id,
      name: searchData.QueryResponse.Item[0].Name
    };
  }

  // Create new service item
  console.log(`[QBO Service] Item '${cleanPlanName}' not found. Creating a new Service Item...`);
  const incomeAccountRef = await getIncomeAccountRef(accessToken, realmId);
  const createUrl = `${baseUrl}/v3/company/${realmId}/item?minorversion=75`;

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      Name: cleanPlanName,
      Type: 'Service',
      IncomeAccountRef: incomeAccountRef
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create QBO Item: ${createRes.statusText} - ${errText}`);
  }

  const createData = await createRes.json();
  console.log(`[QBO Service] Created new QBO service item: ${cleanPlanName} (ID: ${createData.Item.Id})`);
  return {
    value: createData.Item.Id,
    name: createData.Item.Name
  };
};

/**
 * Create a new QBO Invoice for a success purchase.
 */
export const createQboInvoice = async (customer, contract, paymentIntent) => {
  console.log('[QBO Service] Commencing QBO Invoice synchronization process...');
  
  const tokenData = await getValidQboToken();
  if (!tokenData) {
    console.warn('[QBO Service] QuickBooks is not connected or missing token records. Skipping Invoice creation.');
    return false;
  }

  const { accessToken, realmId } = tokenData;
  const baseUrl = await getQboBaseUrl();

  try {
    // 1. Resolve Customer
    const qboCustomerId = await getOrCreateQboCustomer(accessToken, realmId, customer);

    // 2. Resolve Service Item
    const qboItem = await getOrCreateQboItem(accessToken, realmId, contract.service_plan);

    // 3. Construct Invoice Lines
    const lines = [];
    const taxAmount = contract.tax_amount ? parseFloat(contract.tax_amount) : 0;

    if (taxAmount > 0) {
      const baseAmount = parseFloat(contract.amount) - taxAmount;
      lines.push({
        Description: `Boat Lift Protection - ${contract.service_plan} Plan (Base Price)`,
        Amount: baseAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: qboItem.value,
            name: qboItem.name
          },
          UnitPrice: baseAmount,
          Qty: 1,
          ServiceDate: contract.contract_start_date ? new Date(contract.contract_start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }
      });

      // Resolve and add Sales Tax Line
      const qboTaxItem = await getOrCreateQboItem(accessToken, realmId, "Sales Tax");
      lines.push({
        Description: `${contract.tax_county || 'Florida'} Sales Tax (${(parseFloat(contract.tax_rate) * 100).toFixed(1)}%)`,
        Amount: taxAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: qboTaxItem.value,
            name: qboTaxItem.name
          },
          UnitPrice: taxAmount,
          Qty: 1,
          ServiceDate: contract.contract_start_date ? new Date(contract.contract_start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }
      });
    } else {
      // Backward compatibility / No Tax
      lines.push({
        Description: `Boat Lift Protection - ${contract.service_plan} Plan`,
        Amount: parseFloat(contract.amount),
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: qboItem.value,
            name: qboItem.name
          },
          UnitPrice: parseFloat(contract.amount),
          Qty: 1,
          ServiceDate: contract.contract_start_date ? new Date(contract.contract_start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }
      });
    }

    // Add Subtotal Line
    lines.push({
      Amount: parseFloat(contract.amount),
      DetailType: "SubTotalLineDetail",
      SubTotalLineDetail: {}
    });

    // 4. Assemble and POST Invoice
    const invoiceUrl = `${baseUrl}/v3/company/${realmId}/invoice?minorversion=75`;
    const invoicePayload = {
      CustomerRef: {
        value: qboCustomerId
      },
      BillEmail: {
        Address: customer.email || ''
      },
      BillAddr: {
        City: customer.city || '',
        CountrySubDivisionCode: customer.state || '',
        PostalCode: customer.zip_code || ''
      },
      CustomerMemo: {
        value: `Thank you for your purchase of the ${contract.service_plan} plan!`
      },
      Line: lines
    };

    console.log(`[QBO Service] Sending Invoice payload to QuickBooks:`, JSON.stringify(invoicePayload));

    const invoiceRes = await fetch(invoiceUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text();
      throw new Error(`Failed to create QBO Invoice: ${invoiceRes.statusText} - ${errText}`);
    }

    const invoiceData = await invoiceRes.json();
    console.log(`[QBO Service] QBO Invoice successfully generated! ID: ${invoiceData.Invoice.Id}`);
    return true;
  } catch (error) {
    console.error('[QBO Service] Error occurred during QBO Invoice creation workflow:', error);
    throw error;
  }
};