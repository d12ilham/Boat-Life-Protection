import db from "../config/db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { createQboInvoice } from "./qboService.js";
import { syncToHubSpot } from "./hubspotService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const triggerAllAutomations = async (
  contract_id,
  customer_id,
  paymentIntent,
) => {
  console.log(
    `[Integration Service] Starting automation for contract ${contract_id}`,
  );

  const contractRes = await db.query("SELECT * FROM contracts WHERE id = $1", [
    contract_id,
  ]);
  const custRes = await db.query("SELECT * FROM customers WHERE id = $1", [
    customer_id,
  ]);

  if (!contractRes.rows[0] || !custRes.rows[0]) return;

  const contract = contractRes.rows[0];
  const customer = custRes.rows[0];

  // Resolve the pre-saved GALT PDF path from database (saved by galtController after submission)
  let pdfPath = null;
  if (contract.pdf_url) {
    const receiptsDir = path.join(__dirname, "..", "..", "public", "receipts");
    const candidate = path.join(receiptsDir, path.basename(contract.pdf_url));
    if (fs.existsSync(candidate)) {
      pdfPath = candidate;
    } else {
      console.warn(
        `[Integration Service] GALT PDF file not found on disk: ${candidate}`,
      );
    }
  } else {
    console.warn(
      `[Integration Service] No pdf_url in database for contract ${contract_id}`,
    );
  }

  await Promise.allSettled([
    sendEmails(customer, contract, pdfPath),
    updateHubSpot(customer, contract),
    createQuickBooksSale(customer, contract, paymentIntent),
  ]);

  console.log(
    `[Integration Service] Completed automation for contract ${contract_id}`,
  );
};

async function sendEmails(customer, contract, pdfPath) {
  console.log("Sending emails to Customer, Shop, and Boat Lift Protection...");

  let transporter;

  // Use real SMTP environment variables if they are configured
  if (
    process.env.SMTP_HOST &&
    !process.env.SMTP_HOST.includes("xxxx") &&
    !process.env.SMTP_PASS.includes("xxxx")
  ) {
    console.log("[Email] Using production SMTP configuration from env");
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    });
  } else {
    // Attempt Ethereal test account with short timeout, fallback to silent mock transport
    try {
      console.log("[Email] Fetching Ethereal test account with timeouts...");
      const testAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ethereal setup timed out")), 4000),
        ),
      ]);

      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      });
    } catch (err) {
      console.warn(
        "[Email] SMTP Setup failed (offline or firewall). Falling back to mock email transport:",
        err.message,
      );
    }
  }

  // Define helper utility to log Ethereal preview URLs safely
  const logPreviewUrl = (info) => {
    try {
      if (info && typeof nodemailer.getTestMessageUrl === "function") {
        const url = nodemailer.getTestMessageUrl(info);
        if (url) {
          console.log(`[Email] Ethereal preview URL: ${url}`);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Attach the GALT-provided PDF if it exists on disk
  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `BoatLift_Contract_${contract.id}.pdf`,
      path: pdfPath,
    });
  }

  const fromEmail = process.env.EMAIL_FROM || "noreply@boatlift.app";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@boatlift.app";
  const vendorEmail = `vendor_${contract.technician_name ? contract.technician_name.replace(/\s+/g, "").toLowerCase() : "notify"}@boatliftprotection.com`;
  const fullName =
    `${customer.first_name || ""} ${customer.middle_initial ? customer.middle_initial + " " : ""}${customer.last_name || ""}${customer.suffix ? " " + customer.suffix : ""}`.trim() ||
    customer.name;

  let customerSent = false;
  let adminSent = false;

  // 1. Email to Customer
  try {
    const custInfo = await transporter.sendMail({
      from: `"Boat Lift Protection" <${fromEmail}>`,
      to: customer.email,
      subject: `Your Boat Lift Service Contract`,
      text: `Hello ${fullName},\n\nThank you for choosing Boat Lift Protection. Your payment of $${contract.amount} for the ${contract.service_plan} was successful.\n\nPlease find your official GALT service contract attached.\n\nRegards,\nBoat Lift Team`,
      attachments,
    });
    logPreviewUrl(custInfo);
    customerSent = true;
  } catch (e) {
    console.error(`[Email] Failed customer send:`, e);
  }

  // 2. Email to

  try {
    const adminInfo = await transporter.sendMail({
      from: `"Boat Lift Protection" <${fromEmail}>`,
      to: adminEmail,
      subject: `[NEW SALE] ${contract.service_plan} - ${fullName}`,
      text: `New Contract Signed!\n\nCustomer: ${fullName}\nEmail: ${customer.email}\nPhone: ${customer.home_phone || customer.phone}\nAddress: ${customer.street_address || customer.address}\n\nAmount: $${contract.amount}\nTechnician: ${contract.technician_name}\n\n${pdfPath ? "GALT Contract PDF Attached." : "No PDF available - GALT submission may have failed."}`,
      attachments,
    });
    logPreviewUrl(adminInfo);
    adminSent = true;
  } catch (e) {
    console.error(`[Email] Failed admin send:`, e);
  }

  // 3. Email to Vendor
  // try {
  //   const vendorInfo = await transporter.sendMail({
  //     from: `"Boat Lift Protection" <${fromEmail}>`,
  //     to: vendorEmail,
  //     subject: `[SALE CONFIRMATION] You closed a deal!`,
  //     text: `Great job, ${contract.technician_name || "Vendor"}!\n\nYou successfully sold a ${contract.service_plan} plan to ${fullName} for $${contract.amount}.\nKeep up the great work!`,
  //   });
  //   logPreviewUrl(vendorInfo);
  // } catch (e) {
  //   console.error(`[Email] Failed vendor send:`, e);
  // }

  const finalStatus = (customerSent && adminSent) ? 'success' : 'failed';
  await db.query("UPDATE contracts SET email_sent_status = $1 WHERE id = $2", [finalStatus, contract.id]).catch(console.error);
}

async function updateHubSpot(customer, contract) {
  console.log("[HubSpot] Starting CRM sync for contract", contract.id);
  try {
    const result = await syncToHubSpot(customer, contract);
    console.log("[HubSpot] Synced - contactId=" + result.contactId + ", dealId=" + result.dealId);
    await db.query("UPDATE contracts SET hubspot_sync_status = 'success' WHERE id = $1", [contract.id]);
    return true;
  } catch (err) {
    console.error("[HubSpot] Sync failed:", err.message);
    await db.query("UPDATE contracts SET hubspot_sync_status = 'failed' WHERE id = $1", [contract.id]).catch(console.error);
    return false;
  }
}

async function createQuickBooksSale(customer, contract, paymentIntent) {
  console.log("Creating entry in QuickBooks...");
  try {
    const success = await createQboInvoice(customer, contract, paymentIntent);
    const status = success ? 'success' : 'failed';
    await db.query("UPDATE contracts SET qbo_sync_status = $1 WHERE id = $2", [status, contract.id]);
    return success;
  } catch (err) {
    console.error(
      "[Integration Service] QuickBooks Invoice creation failed:",
      err.message,
    );
    await db.query("UPDATE contracts SET qbo_sync_status = 'failed' WHERE id = $1", [contract.id]).catch(console.error);
    return false;
  }
}

