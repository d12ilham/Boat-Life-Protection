import fs from "fs";
import path from "path";
import db from "../config/db.js";
import { getSetting } from "../config/configResolver.js";

/**
 * Service to handle 3-minute GALT application expiry,
 * automatic GALT voiding (/void.aspx), and removal of physical PDF files.
 */

// Helper to get GALT credentials
const getGaltCredentials = async () => ({
  Username: await getSetting("GALT_USERNAME"),
  Password: await getSetting("GALT_PASSWORD"),
  DealerNumber: await getSetting("GALT_DEALER_NUMBER"),
});

// Helper to call GALT API
const galtFetch = async (endpoint, payload) => {
  const baseUrl = await getSetting("GALT_API_BASE_URL");
  if (!baseUrl) throw new Error("Galt API Base URL is not configured.");

  const creds = await getGaltCredentials();
  const sanitizedPayload = { ...payload };
  if (sanitizedPayload.VIN) {
    sanitizedPayload.VIN = String(sanitizedPayload.VIN)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
  }
  if (sanitizedPayload.vin) {
    sanitizedPayload.vin = String(sanitizedPayload.vin)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
  }

  const fullPayload = { ...sanitizedPayload, ...creds };
  const authHeader =
    "Basic " +
    Buffer.from(creds.Username + ":" + creds.Password).toString("base64");

  const response = await fetch(baseUrl + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(fullPayload),
  });

  const textData = await response.text();
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    data = { rawResponse: textData };
  }
  return { data, ok: response.ok, status: response.status };
};

/**
 * Remove physical PDF files stored on the server for a given contract.
 */
export const deleteContractPdfs = (contractId, pdfUrl) => {
  const receiptsDir = path.join(process.cwd(), "public", "receipts");
  const candidates = new Set();

  if (pdfUrl) {
    candidates.add(path.join(process.cwd(), "public", pdfUrl.replace(/^\//, "")));
    candidates.add(path.join(receiptsDir, path.basename(pdfUrl)));
  }
  if (contractId) {
    candidates.add(path.join(receiptsDir, `Contract_GALT_${contractId}.pdf`));
    candidates.add(path.join(receiptsDir, `Contract_Signed_${contractId}.pdf`));
  }

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[GALT Expiry] Removed PDF file from server: ${filePath}`);
      }
    } catch (err) {
      console.warn(`[GALT Expiry] Failed to unlink PDF ${filePath}:`, err.message);
    }
  }
};

/**
 * Void an unpaid GALT application, delete its PDF on the server,
 * and mark the local contract record as voided.
 */
export const voidAndCleanupContract = async (
  contractId,
  reason = "Payment timeout (3 minutes)",
) => {
  if (!contractId) return { success: false, message: "No contractId provided" };

  try {
    const res = await db.query(
      `SELECT id, serial_number, galt_application_id, galt_contract_no, pdf_url, status, galt_sync_status, galt_submitted_at
       FROM contracts
       WHERE id = $1`,
      [contractId],
    );

    if (res.rows.length === 0) {
      return { success: false, message: "Contract not found" };
    }

    const contract = res.rows[0];

    // Never void a contract that was already paid
    if (contract.status === "paid") {
      return { success: false, message: "Contract is already paid; cannot void." };
    }

    const appId = contract.galt_application_id;
    const contractNo = contract.galt_contract_no;
    const cleanVin = contract.serial_number
      ? String(contract.serial_number).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
      : "";

    // 1. Call GALT /void.aspx to cancel the pending application with GALT
    if (appId || contractNo) {
      console.log(
        `[GALT Expiry] Calling GALT /void.aspx for contract #${contractId} (AppID: ${appId}, ContractNo: ${contractNo}, reason: ${reason})...`,
      );
      try {
        const voidPayload = {
          ...(appId ? { ApplicationID: appId } : {}),
          ...(contractNo ? { ContractNo: contractNo } : {}),
          VIN: cleanVin,
        };
        const voidRes = await galtFetch("/void.aspx", voidPayload);
        console.log(
          `[GALT Expiry] Void response for contract #${contractId}:`,
          voidRes.data,
        );
      } catch (voidErr) {
        console.warn(
          `[GALT Expiry] GALT /void.aspx call failed for contract #${contractId}:`,
          voidErr.message,
        );
      }
    }

    // 2. Delete physical PDFs from server public folder
    deleteContractPdfs(contractId, contract.pdf_url);

    // 3. Reset contract GALT and signature fields in database
    await db.query(
      `UPDATE contracts
       SET pdf_url = NULL,
           galt_application_id = NULL,
           galt_contract_no = NULL,
           galt_signatures = NULL,
           galt_sync_status = 'voided',
           status = 'pending',
           signature_name = NULL,
           galt_submitted_at = NULL
       WHERE id = $1 AND status != 'paid'`,
      [contractId],
    );

    console.log(
      `[GALT Expiry] Contract #${contractId} successfully voided and PDFs deleted from server.`,
    );
    return { success: true, voided: true, contractId };
  } catch (err) {
    console.error(`[GALT Expiry] Error voiding contract #${contractId}:`, err);
    return { success: false, error: err.message };
  }
};

/**
 * Sweeper function: checks all unpaid contracts with an active GALT application
 * submitted more than 3 minutes ago, voids them, and deletes PDFs.
 */
export const cleanupExpiredGaltContracts = async () => {
  try {
    const expiredRes = await db.query(
      `SELECT id, galt_application_id, galt_contract_no, galt_submitted_at
       FROM contracts
       WHERE status != 'paid'
         AND galt_sync_status = 'success'
         AND (galt_application_id IS NOT NULL OR galt_contract_no IS NOT NULL)
         AND galt_submitted_at IS NOT NULL
         AND galt_submitted_at < NOW() - INTERVAL '3 minutes'`,
    );

    if (expiredRes.rows.length > 0) {
      console.log(
        `[GALT Expiry Sweeper] Found ${expiredRes.rows.length} contract(s) older than 3 minutes without payment. Voiding and removing PDFs...`,
      );
      for (const row of expiredRes.rows) {
        await voidAndCleanupContract(row.id, "3-minute payment timeout sweep");
      }
    }
  } catch (err) {
    console.error("[GALT Expiry Sweeper] Error during expired contracts cleanup sweep:", err);
  }
};

/**
 * Initializes database column and starts background expiry sweeper interval.
 */
export const startGaltExpiryCron = () => {
  // Ensure schema column exists
  db.query(
    "ALTER TABLE contracts ADD COLUMN IF NOT EXISTS galt_submitted_at TIMESTAMP;",
  )
    .then(() => {
      console.log("[GALT Expiry] Column galt_submitted_at verified in database.");
      // Run an immediate sweep
      cleanupExpiredGaltContracts();
    })
    .catch((err) => {
      console.error(
        "[GALT Expiry] Error verifying column galt_submitted_at:",
        err,
      );
    });

  // Run cleanup sweep every 15 seconds
  const interval = setInterval(cleanupExpiredGaltContracts, 15000);
  return interval;
};
