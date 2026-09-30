import fs from "fs";
import path from "path";
import db from "../config/db.js";
import { voidAndCleanupContract } from "../services/galtExpiryService.js";

async function main() {
  console.log("=== COMPREHENSIVE ONE-TIME UNPAID APPLICATIONS & PDF CLEANUP ===");

  try {
    // 1. Get all paid contract IDs
    const paidRes = await db.query("SELECT id FROM contracts WHERE status = 'paid'");
    const paidIds = new Set(paidRes.rows.map((r) => r.id));
    console.log(`Protected paid contract IDs (${paidIds.size}):`, Array.from(paidIds));

    // 2. Void all unpaid contracts in DB that have GALT data
    const unpaidGaltContracts = await db.query(
      `SELECT id, serial_number, galt_application_id, galt_contract_no, pdf_url
       FROM contracts
       WHERE status != 'paid'
         AND (
           galt_application_id IS NOT NULL 
           OR galt_contract_no IS NOT NULL 
           OR pdf_url IS NOT NULL
           OR galt_sync_status != 'voided'
         )`
    );

    console.log(`Found ${unpaidGaltContracts.rows.length} unpaid contract(s) to reset/void in DB.`);
    for (const c of unpaidGaltContracts.rows) {
      await voidAndCleanupContract(c.id, "Comprehensive one-time bulk cleanup");
    }

    // 3. Clean up any orphaned PDF files in public/receipts for unpaid contracts
    const receiptsDir = path.join(process.cwd(), "public", "receipts");
    if (fs.existsSync(receiptsDir)) {
      const files = fs.readdirSync(receiptsDir);
      console.log(`\nScanning ${files.length} file(s) in receipts folder...`);

      let deletedCount = 0;
      for (const file of files) {
        // Extract contract ID from file name if possible, e.g. Contract_GALT_102.pdf or Contract_CTX_2026_15.pdf
        const match = file.match(/_(\d+)\.pdf$/);
        const fileContractId = match ? parseInt(match[1]) : null;

        if (fileContractId && paidIds.has(fileContractId)) {
          console.log(`[KEEP] ${file} (belongs to paid contract #${fileContractId})`);
        } else {
          const filePath = path.join(receiptsDir, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[DELETED] ${file}`);
          } catch (delErr) {
            console.warn(`[FAILED TO DELETE] ${file}:`, delErr.message);
          }
        }
      }
      console.log(`\nDeleted ${deletedCount} unpaid PDF file(s) from server disk.`);
    }

    console.log("\n=== BULK CLEANUP COMPLETED SUCCESSFULLY ===");
    process.exit(0);
  } catch (err) {
    console.error("Error during bulk cleanup:", err);
    process.exit(1);
  }
}

main();
