import db from '../config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const triggerAllAutomations = async (contract_id, customer_id, paymentIntent) => {
  console.log(`[Integration Service] Starting automation for contract ${contract_id}`);
  
  const contractRes = await db.query('SELECT * FROM contracts WHERE id = $1', [contract_id]);
  const custRes = await db.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
  
  if (!contractRes.rows[0] || !custRes.rows[0]) return;

  const contract = contractRes.rows[0];
  const customer = custRes.rows[0];

  // Resolve the pre-saved GALT PDF path from database (saved by galtController after submission)
  let pdfPath = null;
  if (contract.pdf_url) {
    const receiptsDir = path.join(__dirname, '..', '..', 'public', 'receipts');
    const candidate = path.join(receiptsDir, path.basename(contract.pdf_url));
    if (fs.existsSync(candidate)) {
      pdfPath = candidate;
    } else {
      console.warn(`[Integration Service] GALT PDF file not found on disk: ${candidate}`);
    }
  } else {
    console.warn(`[Integration Service] No pdf_url in database for contract ${contract_id}`);
  }

  await Promise.allSettled([
    sendEmails(customer, contract, pdfPath),
    updateHubSpot(customer, contract),
    createQuickBooksSale(customer, contract, paymentIntent),
  ]);

  console.log(`[Integration Service] Completed automation for contract ${contract_id}`);
};

async function sendEmails(customer, contract, pdfPath) {
  console.log('Sending emails to Customer, Shop, and Boat Lift Protection...');
  
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  // Attach the GALT-provided PDF if it exists on disk
  const attachments = [];
  if (pdfPath && fs.existsSync(pdfPath)) {
    attachments.push({
      filename: `BoatLift_Contract_${contract.id}.pdf`,
      path: pdfPath
    });
  }

  const adminEmail = process.env.EMAIL_FROM || 'admin@boatliftprotection.com';
  const vendorEmail = `vendor_${contract.technician_name ? contract.technician_name.replace(/\s+/g,'').toLowerCase() : 'notify'}@boatliftprotection.com`;
  const fullName = `${customer.first_name || ''} ${customer.middle_initial ? customer.middle_initial + ' ' : ''}${customer.last_name || ''}${customer.suffix ? ' ' + customer.suffix : ''}`.trim() || customer.name;

  // 1. Email to Customer
  try {
    const custInfo = await transporter.sendMail({
      from: `"Boat Lift Protection" <${adminEmail}>`,
      to: customer.email,
      subject: `Your Boat Lift Service Contract`,
      text: `Hello ${fullName},\n\nThank you for choosing Boat Lift Protection. Your payment of $${contract.amount} for the ${contract.service_plan} was successful.\n\nPlease find your official GALT service contract attached.\n\nRegards,\nBoat Lift Team`,
      attachments
    });
    console.log(`[Email] Customer Receipt preview URL: ${nodemailer.getTestMessageUrl(custInfo)}`);
  } catch (e) {
    console.error(`[Email] Failed customer send:`, e);
  }

  // 2. Email to Admin
  try {
    const adminInfo = await transporter.sendMail({
      from: `"System Automations" <system@boatlift.local>`,
      to: adminEmail,
      subject: `[NEW SALE] ${contract.service_plan} - ${fullName}`,
      text: `New Contract Signed!\n\nCustomer: ${fullName}\nEmail: ${customer.email}\nPhone: ${customer.home_phone || customer.phone}\nAddress: ${customer.street_address || customer.address}\n\nAmount: $${contract.amount}\nTechnician: ${contract.technician_name}\n\n${pdfPath ? 'GALT Contract PDF Attached.' : 'No PDF available - GALT submission may have failed.'}`,
      attachments
    });
    console.log(`[Email] Admin Notification preview URL: ${nodemailer.getTestMessageUrl(adminInfo)}`);
  } catch (e) {
    console.error(`[Email] Failed admin send:`, e);
  }

  // 3. Email to Vendor
  try {
    const vendorInfo = await transporter.sendMail({
      from: `"System Automations" <system@boatlift.local>`,
      to: vendorEmail,
      subject: `[SALE CONFIRMATION] You closed a deal!`,
      text: `Great job, ${contract.technician_name || 'Vendor'}!\n\nYou successfully sold a ${contract.service_plan} plan to ${fullName} for $${contract.amount}.\nKeep up the great work!`,
    });
    console.log(`[Email] Vendor Notification preview URL: ${nodemailer.getTestMessageUrl(vendorInfo)}`);
  } catch(e) {
    console.error(`[Email] Failed vendor send:`, e);
  }
}

async function updateHubSpot(customer, contract) {
  console.log('Updating HubSpot CRM...');
  return true;
}

async function createQuickBooksSale(customer, contract, paymentIntent) {
  console.log('Creating entry in QuickBooks...');
  return true;
}
