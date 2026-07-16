import db from '../config/db.js';

const getQboBaseUrl = () => {
  const env = process.env.QBO_ENVIRONMENT || 'sandbox';
  return env === 'production' 
    ? 'https://quickbooks.api.intuit.com' 
    : 'https://sandbox-quickbooks.api.intuit.com';
};

/**
 * Exchange refresh token for a new access token and update the database.
 */
export const refreshQboToken = async (currentRefreshToken) => {
  console.log('[QBO Service] Refreshing QuickBooks access token...');
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks Client ID or Client Secret is missing in environment variables.');
  }

  const credentials = `${clientId}:${clientSecret}`;
  const authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
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
  const baseUrl = getQboBaseUrl();
  const email = customer.email;
  
  if (!email) {
    throw new Error('Customer email is required for QuickBooks synchronization.');
  }

  // Search by Email
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
    console.log(`[QBO Service] Found existing QBO customer ID: ${searchData.QueryResponse.Customer[0].Id}`);
    return searchData.QueryResponse.Customer[0].Id;
  }

  // Create new customer
  console.log(`[QBO Service] Creating new customer in QBO for: ${customer.first_name} ${customer.last_name}`);
  const createUrl = `${baseUrl}/v3/company/${realmId}/customer?minorversion=75`;
  const displayName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.name || 'Walk-In Customer';

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      DisplayName: displayName,
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

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create QBO Customer: ${createRes.statusText} - ${errText}`);
  }

  const createData = await createRes.json();
  console.log(`[QBO Service] Created new QBO customer with ID: ${createData.Customer.Id}`);
  return createData.Customer.Id;
};

/**
 * Helper to get a revenue account for item creation fallback.
 */
const getIncomeAccountRef = async (accessToken, realmId) => {
  const baseUrl = getQboBaseUrl();
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
  const baseUrl = getQboBaseUrl();
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
  const baseUrl = getQboBaseUrl();

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