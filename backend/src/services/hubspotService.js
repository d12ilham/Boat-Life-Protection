/**
 * hubspotService.js
 *
 * Sends customer & contract data to HubSpot CRM after a successful payment.
 *
 * Fields synced:
 *  Contact  : firstname, lastname, email, phone, address, city, state, zip
 *  Deal     : dealname, amount, closedate, lift_type (custom), product_purchased (service_plan)
 *             dealstage is set to "closedwon" since payment has already been collected.
 */

import fetch from "node-fetch";

const HUBSPOT_BASE = "https://api.hubapi.com";

function authHeader() {
  const token = process.env.HUBSPOT_API_KEY;
  if (!token) throw new Error("HUBSPOT_API_KEY is not configured in .env");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function findContactByEmail(email) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts/search`;
  const body = {
    filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
    properties: ["id", "email"],
    limit: 1,
  };
  const res = await fetch(url, { method: "POST", headers: authHeader(), body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact search failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.results && data.results.length > 0 ? data.results[0].id : null;
}

async function createContact(properties) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts`;
  const res = await fetch(url, { method: "POST", headers: authHeader(), body: JSON.stringify({ properties }) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact creation failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.id;
}

async function updateContact(contactId, properties) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts/${contactId}`;
  const res = await fetch(url, { method: "PATCH", headers: authHeader(), body: JSON.stringify({ properties }) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact update failed (${res.status}): ${text}`);
  }
}

async function createDeal(contactId, dealProperties) {
  const createUrl = `${HUBSPOT_BASE}/crm/v3/objects/deals`;
  const createRes = await fetch(createUrl, { method: "POST", headers: authHeader(), body: JSON.stringify({ properties: dealProperties }) });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`HubSpot deal creation failed (${createRes.status}): ${text}`);
  }
  const deal = await createRes.json();
  const dealId = deal.id;

  const assocUrl = `${HUBSPOT_BASE}/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`;
  const assocRes = await fetch(assocUrl, {
    method: "PUT",
    headers: authHeader(),
    body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }]),
  });
  if (!assocRes.ok) {
    const text = await assocRes.text();
    console.warn(`[HubSpot] Deal-Contact association failed (${assocRes.status}): ${text}`);
  }
  return dealId;
}

export async function syncToHubSpot(customer, contract) {
  const contactProperties = {
    email:     customer.email,
    firstname: customer.first_name || (customer.name || "").split(" ")[0] || "",
    lastname:  customer.last_name  || (customer.name || "").split(" ").slice(1).join(" ") || "",
    phone:     customer.home_phone || customer.phone || "",
    address:   customer.street_address || customer.address || "",
    city:      customer.city || "",
    state:     customer.state || "",
    zip:       customer.zip_code || "",
  };

  let contactId = await findContactByEmail(customer.email);
  if (contactId) {
    console.log(`[HubSpot] Updating existing contact ${contactId} (${customer.email})`);
    await updateContact(contactId, contactProperties);
  } else {
    console.log(`[HubSpot] Creating new contact for ${customer.email}`);
    contactId = await createContact(contactProperties);
  }

  const closedate = contract.date_of_sale
    ? new Date(contract.date_of_sale).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const dealProperties = {
    dealname:          `${customer.first_name || customer.name} - ${contract.service_plan}`,
    amount:            String(contract.amount || 0),
    closedate:         closedate,
    dealstage:         "closedwon",
    pipeline:          "default",
    product_purchased: contract.service_plan || "",
    lift_type:         contract.lift_type || "",
  };

  console.log("[HubSpot] Creating deal:", dealProperties.dealname);
  const dealId = await createDeal(contactId, dealProperties);
  console.log(`[HubSpot] Deal ${dealId} created and linked to contact ${contactId}`);

  return { contactId, dealId };
}
