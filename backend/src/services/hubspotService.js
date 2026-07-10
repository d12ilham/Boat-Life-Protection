/**
 * hubspotService.js
 *
 * Sends customer & contract data to HubSpot CRM after a successful payment.
 *
 * Fields synced:
 *  Contact : firstname, lastname, email, phone, address, city, state, zip,
 *            lifecyclestage
 *  Deal    : dealname, amount, closedate, dealstage, pipeline, dealtype,
 *            hubspot_owner_id (optional env)
 *            + BLP custom properties (blp_*) per BLP_HubSpot_Integration_Brief
 */

import fetch from "node-fetch";

const HUBSPOT_BASE = "https://api.hubapi.com";

function authHeader() {
  const token = process.env.HUBSPOT_API_KEY;
  if (!token) throw new Error("HUBSPOT_API_KEY is not configured in .env");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function findContactByEmail(email) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts/search`;
  const body = {
    filterGroups: [
      {
        filters: [{ propertyName: "email", operator: "EQ", value: email }],
      },
    ],
    properties: ["id", "email"],
    limit: 1,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact search failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.results && data.results.length > 0 ? data.results[0].id : null;
}

async function createContact(properties) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.id;
}

async function updateContact(contactId, properties) {
  const url = `${HUBSPOT_BASE}/crm/v3/objects/contacts/${contactId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeader(),
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot contact update failed (${res.status}): ${text}`);
  }
}

async function createDeal(contactId, dealProperties) {
  // Create the deal and associate it with the contact in one API call
  // (per brief Section 4 -- include associations block at deal creation time)
  const createUrl = `${HUBSPOT_BASE}/crm/v3/objects/deals`;
  const payload = {
    properties: dealProperties,
    associations: [
      {
        to: { id: contactId },
        types: [
          { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
        ],
      },
    ],
  };

  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: authHeader(),
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(
      `HubSpot deal creation failed (${createRes.status}): ${text}`
    );
  }

  const deal = await createRes.json();
  return deal.id;
}

/**
 * Derive blp_product_id (102 = PMP/Maintenance, 103 = ESC/Service Contract)
 * from service_plan name.
 */
function deriveProductId(servicePlan) {
  if (!servicePlan) return null;
  const lower = String(servicePlan).toLowerCase();
  if (lower.includes("pmp") || lower.includes("maintenance")) return "102";
  if (lower.includes("esc") || lower.includes("service contract")) return "103";
  return null;
}

/**
 * Derive blp_coverage_level (Gold / Platinum) from service_plan or lift_category.
 * Only applicable for ESC plans.
 */
function deriveCoverageLevel(servicePlan, liftCategory) {
  const text = `${servicePlan || ""} ${liftCategory || ""}`.toLowerCase();
  if (text.includes("platinum")) return "Platinum";
  if (text.includes("gold")) return "Gold";
  return null;
}

/**
 * Derive blp_motor_count (1, 2, or 4) from service_plan or lift_category.
 * Only applicable for PMP plans.
 */
function deriveMotorCount(servicePlan, liftCategory) {
  const text = `${servicePlan || ""} ${liftCategory || ""}`.toLowerCase();
  if (text.includes("4 motor") || text.includes("4-motor")) return "4";
  if (text.includes("2 motor") || text.includes("2-motor")) return "2";
  if (text.includes("1 motor") || text.includes("1-motor")) return "1";
  return null;
}

/**
 * Calculate a renewal alert date (30 days before contract end date).
 */
function deriveRenewalAlertDate(contractEndDate) {
  if (!contractEndDate) return null;
  try {
    const end = new Date(contractEndDate);
    end.setDate(end.getDate() - 30);
    return end.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Derive the plan type in the format required by HubSpot dropdown:
 * ESC Gold, ESC Platinum, PMP 1-Motor, PMP 2-Motor, PMP 4-Motor
 */
function derivePlanType(contract) {
  const servicePlan = contract.service_plan || "";
  const coverage = contract.coverage || "";
  
  const isPmp = servicePlan.toLowerCase().includes("pmp") || servicePlan.toLowerCase().includes("maintenance");
  const isEsc = servicePlan.toLowerCase().includes("esc") || servicePlan.toLowerCase().includes("service contract");

  if (isPmp) {
    let motors = "1-Motor";
    if (coverage.toLowerCase().includes("2 motor") || coverage.toLowerCase().includes("2-motor") || coverage.includes("2")) motors = "2-Motor";
    else if (coverage.toLowerCase().includes("4 motor") || coverage.toLowerCase().includes("4-motor") || coverage.includes("4")) motors = "4-Motor";
    else {
      // Fallback
      const text = `${servicePlan} ${contract.lift_category || ""}`.toLowerCase();
      if (text.includes("4 motor") || text.includes("4-motor")) motors = "4-Motor";
      else if (text.includes("2 motor") || text.includes("2-motor")) motors = "2-Motor";
    }
    return `PMP ${motors}`;
  }

  if (isEsc) {
    let level = "Gold";
    if (coverage.toLowerCase().includes("platinum")) level = "Platinum";
    else {
      // Fallback
      const text = `${servicePlan} ${contract.lift_category || ""}`.toLowerCase();
      if (text.includes("platinum")) level = "Platinum";
    }
    return `ESC ${level}`;
  }

  return servicePlan;
}

/**
 * Main entry point called by integrationService.js
 */
export async function syncToHubSpot(customer, contract) {
  // -- Contact upsert ──────────────────────────────────────────────────────
  const contactProperties = {
    email: customer.email,
    firstname:
      customer.first_name || (customer.name || "").split(" ")[0] || "",
    lastname:
      customer.last_name ||
      (customer.name || "").split(" ").slice(1).join(" ") ||
      "",
    phone: customer.home_phone || customer.phone || "",
    address: customer.street_address || customer.address || "",
    city: customer.city || "",
    state: customer.state || "",
    zip: customer.zip_code || "",
    lifecyclestage: "customer",
  };

  let contactId = await findContactByEmail(customer.email);
  if (contactId) {
    console.log(
      `[HubSpot] Updating existing contact ${contactId} (${customer.email})`
    );
    await updateContact(contactId, contactProperties);
  } else {
    console.log(`[HubSpot] Creating new contact for ${customer.email}`);
    contactId = await createContact(contactProperties);
  }

  // -- Deal creation ────────────────────────────────────────────────────────
  const saleDate = contract.date_of_sale
    ? new Date(contract.date_of_sale).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  // ISO 8601 format with time component as required by brief Section 3.1
  const closedateISO = `${saleDate}T00:00:00Z`;

  // Deal name format per brief: [Plan Type] - [Customer Full Name] - [YYYY-MM-DD]
  const customerFullName =
    [
      customer.first_name || (customer.name || "").split(" ")[0] || "",
      customer.last_name ||
        (customer.name || "").split(" ").slice(1).join(" ") ||
        "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || customer.email;

  const dealName = `${contract.service_plan || "BLP Plan"} - ${customerFullName} - ${saleDate}`;

  const productId = deriveProductId(contract.service_plan);
  const rawCoverage = contract.coverage || "";
  const coverageLower = rawCoverage.toLowerCase();

  const coverageLevel = coverageLower.includes("platinum")
    ? "Platinum"
    : coverageLower.includes("gold")
      ? "Gold"
      : deriveCoverageLevel(contract.service_plan, contract.lift_category);

  const motorCount = coverageLower.includes("motor")
    ? rawCoverage.replace(/[^0-9]/g, "")
    : deriveMotorCount(contract.service_plan, contract.lift_category);

  const renewalAlertDate = deriveRenewalAlertDate(contract.contract_end_date);

  const dealProperties = {
    dealname: dealName,
    amount: String(contract.amount || 0),
    closedate: closedateISO,
    dealstage: "closedwon",
    pipeline: process.env.HUBSPOT_PIPELINE_ID || "default",
    dealtype: "newbusiness",
    ...(process.env.HUBSPOT_OWNER_ID
      ? { hubspot_owner_id: process.env.HUBSPOT_OWNER_ID }
      : {}),

    // Custom BLP Deal Properties (must be created in HubSpot first)
    blp_plan_type: derivePlanType(contract),
    ...(productId ? { blp_product_id: productId } : {}),
    ...(coverageLevel ? { blp_coverage_level: coverageLevel } : {}),
    ...(motorCount ? { blp_motor_count: motorCount } : {}),
    blp_lift_type: contract.lift_type || "",
    blp_lift_weight_range: contract.lift_category || "",
    blp_vehicle_status: contract.vehicle_status || "NEW",

    blp_contract_start_date: saleDate,
    ...(contract.contract_end_date
      ? {
          blp_contract_end_date: new Date(contract.contract_end_date)
            .toISOString()
            .split("T")[0],
        }
      : {}),
    ...(renewalAlertDate ? { blp_renewal_alert_date: renewalAlertDate } : {}),

    ...(contract.stripe_payment_id
      ? { blp_stripe_payment_id: contract.stripe_payment_id }
      : {}),
    blp_technician_name: contract.technician_name || "",
    ...(contract.galt_contract_no
      ? { blp_galt_contract_id: contract.galt_contract_no }
      : {}),
  };

  console.log("[HubSpot] Creating deal:", dealProperties.dealname);
  const dealId = await createDeal(contactId, dealProperties);
  console.log(
    `[HubSpot] Deal ${dealId} created and linked to contact ${contactId}`
  );

  return { contactId, dealId };
}