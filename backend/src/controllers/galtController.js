import fs from "fs";
import path from "path";
import db from "../config/db.js";
import { getSetting } from "../config/configResolver.js";
import { voidAndCleanupContract } from "../services/galtExpiryService.js";

/**
 * Controller for Galt F&I Online Interface API endpoints
 * Products: 102 = Maintenance (PMP), 103 = Service Contract (ESC)
 */

const getGaltCredentials = async () => ({
  Username: await getSetting("GALT_USERNAME"),
  Password: await getSetting("GALT_PASSWORD"),
  DealerNumber: await getSetting("GALT_DEALER_NUMBER"),
});

const galtFetch = async (endpoint, payload) => {
  const baseUrl = await getSetting("GALT_API_BASE_URL");
  if (!baseUrl) throw new Error("Galt API Base URL is not configured.");

  const creds = await getGaltCredentials();
  
  // Sanitize VIN parameter for Galt API endpoints (strip spaces/special chars and convert to uppercase)
  const sanitizedPayload = { ...payload };
  if (sanitizedPayload.VIN) {
    sanitizedPayload.VIN = String(sanitizedPayload.VIN).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }
  if (sanitizedPayload.vin) {
    sanitizedPayload.vin = String(sanitizedPayload.vin).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  }

  const fullPayload = { ...sanitizedPayload, ...creds };
  const authHeader =
    "Basic " +
    Buffer.from(creds.Username + ":" + creds.Password).toString("base64");

  // console.log("[GALT] POST", endpoint, JSON.stringify(fullPayload));

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
 * POST /api/galt/rate  â€” get rate options from GALT
 */
export const getRate = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/rateymm.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt rate API:", error);
    return res.status(500).json({
      message: "Failed to retrieve rate from Galt API",
      error: error.message,
    });
  }
};

/**
 * POST /api/galt/app  â€” submit application to GALT
 */
export const submitApp = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/app.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt app API:", error);
    return res.status(500).json({
      message: "Failed to submit application to Galt API",
      error: error.message,
    });
  }
};

/**
 * Auto-void previous unpaid GALT applications for a given VIN/serial_number and/or contractId
 * so that GALT's portal never accumulates duplicate pending applications for the same lift.
 */
const autoVoidPreviousGaltApps = async (cleanVin, currentContractId, newApplicationId) => {
  if (!cleanVin) return;

  try {
    // Find previous unpaid contracts for this VIN that have an active GALT contract/app
    const previousApps = await db.query(
      `SELECT id, galt_application_id, galt_contract_no, status, galt_sync_status 
       FROM contracts 
       WHERE (serial_number = $1 OR id = $2)
         AND status != 'paid'
         AND (
           (galt_application_id IS NOT NULL AND galt_application_id != $3)
           OR (galt_contract_no IS NOT NULL AND id != $2 AND galt_sync_status = 'success')
         )`,
      [cleanVin, currentContractId, String(newApplicationId)]
    );

    for (const row of previousApps.rows) {
      const oldAppId = row.galt_application_id;
      const oldContractNo = row.galt_contract_no;
      console.log(
        `[GALT Auto-Void] Voiding previous unpaid GALT application (AppID: ${oldAppId}, ContractNo: ${oldContractNo}, ContractDB: #${row.id}) for VIN ${cleanVin}...`
      );

      try {
        const voidPayload = {
          ...(oldAppId ? { ApplicationID: oldAppId } : {}),
          ...(oldContractNo ? { ContractNo: oldContractNo } : {}),
          VIN: cleanVin,
        };

        const voidResult = await galtFetch("/void.aspx", voidPayload);

        console.log(
          `[GALT Auto-Void] GALT response for ApplicationID ${oldAppId || oldContractNo}:`,
          voidResult.data
        );

        if (row.id !== currentContractId) {
          await db.query(
            `UPDATE contracts SET galt_sync_status = 'voided' WHERE id = $1 AND status != 'paid'`,
            [row.id]
          );
        }
      } catch (voidErr) {
        console.warn(
          `[GALT Auto-Void] Failed to void GALT ApplicationID ${oldAppId}:`,
          voidErr.message
        );
      }
    }
  } catch (err) {
    console.error("[GALT Auto-Void] Error querying previous GALT applications:", err);
  }
};

/**
 * POST /api/galt/submit  — orchestrated two-step Rate → App flow
 *
 * The frontend sends all customer/lift data. This endpoint:
 *   1. Calls /rateymm.aspx to get ProductID, Coverage, TermMonths, Deductible, DealerCost
 *   2. Merges those with the customer/lift data
 *   3. Calls /app.aspx and returns the full result
 *
 * Field mapping follows Gary's confirmed spec:
 *   - FIXED: CurrentOdometer=0, OdometerType="no", TermMiles=999999, Deductible=0
 *   - FIXED: Surcharges=[], ReqFields=[]
 *   - NOT USED (omitted): LH*, AmountFinanced, FinanceTerm, APR, EngineSize*, MSRP*
 *   - VehicleSalePrice = lift value midpoint (from dropdown, NOT retail price for PMP)
 *   - RetailPrice = contract price ($3000 flat for PMP, category price for ESC)
 */
export const submitFullApp = async (req, res) => {
  try {
    const {
      contractId,
      // Technician
      FIManager,
      // Customer
      FirstName,
      LastName,
      MiddleInitial,
      Suffix,
      HomePhoneNo,
      BusinessPhoneNo,
      Address1,
      City,
      State,
      ZipCode,
      Email,
      // Lift
      VIN,
      VehicleStatus,
      Year,
      Make,
      Model,
      DateOfSale,
      InServiceDate,
      VehicleSalePrice,
      MnfWarrantyLength,
      // Product selection (from ServiceSelection step)
      ProductType, // "maintenance" | "service_contract"
      Coverage, // "1 Motor"|"2 Motor"|"4 Motor" | "Gold"|"Platinum"
      ContractType, // "Post"|"Lean To" (ESC only)
      RetailPrice,
    } = req.body;

    // Map our product type to expected ProductID for rate call
    // GALT ProductID 102 = PMP (Maintenance), 103 = ESC (Service Contract)
    const expectedProductId = ProductType === "maintenance" ? 102 : 103;
    const expectedTermMonths = ProductType === "maintenance" ? 36 : 60;

    // Enforce NEW or USED status (never "N/A")
    let finalVehicleStatus = "NEW";
    if (VehicleStatus === "USED" || VehicleStatus === "NEW") {
      finalVehicleStatus = VehicleStatus;
    }

    // â”€â”€ Step A: Rate call â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ratePayload = {
      ProductID: expectedProductId,
      VIN: VIN,
      VehicleSalePrice: parseFloat(VehicleSalePrice) || 0,
      Year: String(Year || new Date().getFullYear()),
      Make: Make || "N/A",
      Model: Model || "N/A",
      VehicleStatus: finalVehicleStatus,
      TermMonths: expectedTermMonths,
      Deductible: 0,
      InServiceDate: InServiceDate,
      CurrentOdometer: 0,
      OdometerType: "no",
      TermMiles: 999999,
      Coverage: Coverage || "",
      EngineSize: "0",
      EngineSizeType: "no",
      Industry: "Marine",
      NewUsed: finalVehicleStatus === "USED" ? "Used" : "New",
    };

    const rateResult = await galtFetch("/rateymm.aspx", ratePayload);
    console.log("[GALT] Rate response:", JSON.stringify(rateResult.data));

    // Extract rate data â€” GALT returns an envelope containing "Premiums" array
    let chosenRate = null;
    const premiums =
      rateResult.data?.Premiums || rateResult.data?.premiums || [];

    if (Array.isArray(premiums) && premiums.length > 0) {
      // Find the premium matching the chosen coverage (e.g. "1 Motor", "Gold", etc.)
      const matchedPremium =
        premiums.find(
          (p) =>
            String(p.Coverage || p.coverage).toLowerCase() ===
            String(Coverage).toLowerCase(),
        ) || premiums[0];

      if (matchedPremium) {
        // Find standard deductible (deductible = 0)
        const deductibles =
          matchedPremium.Deductibles || matchedPremium.deductibles || [];
        const matchedDeductible =
          deductibles.find((d) => d.Number === 0 || d.number === 0) ||
          deductibles[0];

        // Parse DealerCost (strip commas and parse as float)
        let dealerCost = 0;
        if (matchedDeductible && matchedDeductible.DealerCost !== undefined) {
          const rawCost = String(matchedDeductible.DealerCost).replace(
            /,/g,
            "",
          );
          dealerCost = parseFloat(rawCost) || 0;
        }
        // Parse RetailPrice from GALT. This is the filed rate Florida validates against.
        // We use GALT's exact number directly without custom rounding.
        let retailPrice = 0;
        const rawGaltRetail =
          matchedDeductible?.RetailPrice !== undefined
            ? matchedDeductible.RetailPrice
            : matchedDeductible?.retailPrice;
        if (rawGaltRetail !== undefined && rawGaltRetail !== null) {
          const rawRetail = String(rawGaltRetail).replace(/,/g, "");
          retailPrice = parseFloat(rawRetail) || 0;
        }
        if (!retailPrice && RetailPrice) {
          retailPrice = parseFloat(RetailPrice) || 0;
        }
        chosenRate = {
          ProductID:
            matchedPremium.ProductId ||
            matchedPremium.ProductID ||
            expectedProductId,
          Coverage: matchedPremium.Coverage || Coverage,
          TermMonths: matchedPremium.TermMonths || expectedTermMonths,
          Deductible: matchedDeductible
            ? matchedDeductible.Number !== undefined
              ? matchedDeductible.Number
              : matchedDeductible.number
            : 0,
          DealerCost: dealerCost,
          RetailPrice: retailPrice,
        };
      }
    }

    if (!chosenRate) {
      const galtErrors =
        rateResult.data?.Errors || rateResult.data?.errors || null;
      const errorMsg =
        Array.isArray(galtErrors) && galtErrors.length > 0
          ? `Galt rate call failed: ${galtErrors.map((e) => e.Description || e.description || JSON.stringify(e)).join(", ")}`
          : `Galt rate call returned no usable rate for ProductID ${expectedProductId} (${ProductType}) under the requested parameters (Make: "${Make}", Model: "${Model}", Year: "${Year}", Coverage: "${Coverage}").`;

      console.error(`[GALT] ${errorMsg}`, JSON.stringify(rateResult.data));
      return res.status(400).json({
        message: errorMsg,
        errors: galtErrors,
        _galtRawResponse: rateResult.data,
      });
    }

    // ── Step B: App submission ──────────────────────────────────────────────
    const appPayload = {
      // Technician
      FIManager: FIManager || "N/A",

      // Customer
      FirstName,
      LastName,
      MiddleInitial: MiddleInitial || "",
      Suffix: Suffix || "",
      HomePhoneNo,
      BusinessPhoneNo: BusinessPhoneNo || "",
      Address1,
      City,
      State,
      ZipCode,
      Email: Email || "",

      // Lift (VIN = serial number, not a vehicle VIN)
      VIN,
      VehicleStatus: finalVehicleStatus,
      Year: parseInt(Year) || null,
      Make,
      Model,
      DateOfSale,
      InServiceDate,
      VehicleSalePrice: parseFloat(VehicleSalePrice) || 0,
      MnfWarrantyLength: parseInt(MnfWarrantyLength) || 0,

      // Fixed — lift has no odometer / mileage
      CurrentOdometer: 0,
      OdometerType: "no",
      TermMiles: 999999,
      Deductible: 0,

      // FROM RATE response
      ProductId:
        chosenRate.ProductID || chosenRate.ProductId || expectedProductId,
      ProductID:
        chosenRate.ProductID || chosenRate.ProductId || expectedProductId,
      productId:
        chosenRate.ProductID || chosenRate.ProductId || expectedProductId,
      Coverage: chosenRate.Coverage || Coverage,
      TermMonths: chosenRate.TermMonths || expectedTermMonths,
      DealerCost: chosenRate.DealerCost || 0,
      dealerCost: chosenRate.DealerCost || 0,

      // Pricing (use GALT filed rate directly)
      RetailPrice: chosenRate.RetailPrice,

      // Fixed empty arrays (NOT optional objects)
      Surcharges: [],
      ReqFields: [],

      // NOT USED — omitted entirely:
      // LHName, LHAddress, LHCity, LHState, LHZipCode, LHPhoneNo, LHAccountNumber
      // AmountFinanced, FinanceTerm, FinanceType, APR
      // EngineSize, EngineSizeType, MSRPNADAValue
    };

    const appResult = await galtFetch("/app.aspx", appPayload);
    // console.log('[GALT] App response:', JSON.stringify(appResult.data, null, 2));

    // If GALT submission is successful, decode and save the PDF and sync contract pricing
    if (appResult.ok && appResult.data && contractId) {
      const appData = appResult.data.App || appResult.data;
      const pdfBase64 = appData.PDF || appResult.data.PDF;
      const galtContractNo =
        appData.ContractNo || appResult.data.ContractNo || null;
      const galtApplicationId =
        appData.ApplicationID || appResult.data.ApplicationID || null;
      const signatures = appData.Signatures || appResult.data.Signatures || [];

      let savedPdfUrl = null;
      if (pdfBase64) {
        try {
          const receiptsDir = path.join(process.cwd(), "public", "receipts");
          if (!fs.existsSync(receiptsDir)) {
            fs.mkdirSync(receiptsDir, { recursive: true });
          }
          const fileName = `Contract_GALT_${contractId}.pdf`;
          const filePath = path.join(receiptsDir, fileName);
          const pdfBuffer = Buffer.from(pdfBase64, "base64");
          fs.writeFileSync(filePath, pdfBuffer);
          savedPdfUrl = `/receipts/${fileName}`;
          console.log(
            `[GALT] Saved PDF for contract ${contractId} to ${savedPdfUrl}`,
          );
        } catch (saveErr) {
          console.error("[GALT] Failed to save GALT PDF:", saveErr);
        }
      }

      // Read contract tax_rate to recalculate sales tax on GALT's official filed retailPrice
      const contractRow = await db.query(
        "SELECT tax_rate FROM contracts WHERE id = $1",
        [contractId],
      );
      const taxRate =
        contractRow.rows.length > 0 && contractRow.rows[0].tax_rate
          ? parseFloat(contractRow.rows[0].tax_rate)
          : 0;

      const finalGaltRetail = chosenRate.RetailPrice || parseFloat(RetailPrice) || 0;
      const newTaxAmount = Math.round(finalGaltRetail * taxRate * 100) / 100;

      const stripeTestMode = await getSetting("STRIPE_TEST_MODE");
      const isTestMode =
        stripeTestMode === "true" ||
        (stripeTestMode === null &&
          (process.env.NODE_ENV || "development").toLowerCase() ===
            "development");

      const newTotalAmount = isTestMode ? 1.0 : finalGaltRetail + newTaxAmount;

      await db.query(
        `UPDATE contracts 
         SET pdf_url = COALESCE($1, pdf_url), 
             galt_signatures = $2, 
             galt_sync_status = 'success', 
             galt_contract_no = $3,
             galt_application_id = $4,
             retail_price = $5,
             tax_amount = $6,
             amount = $7,
             galt_submitted_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
          savedPdfUrl,
          JSON.stringify(signatures),
          galtContractNo,
          galtApplicationId ? String(galtApplicationId) : null,
          finalGaltRetail,
          newTaxAmount,
          newTotalAmount,
          contractId,
        ],
      );

      // Auto-void any previous unpaid GALT applications for this lift to eliminate duplicates in GALT
      const cleanVin = VIN
        ? String(VIN).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
        : null;
      if (cleanVin && galtApplicationId) {
        autoVoidPreviousGaltApps(cleanVin, contractId, galtApplicationId).catch(
          (voidErr) => {
            console.error("[GALT Auto-Void] Background void error:", voidErr);
          },
        );
      }
    } else if (contractId) {
      await db
        .query(
          "UPDATE contracts SET galt_sync_status = 'failed' WHERE id = $1",
          [contractId],
        )
        .catch(console.error);
    }

    // Attach the rate data and synced pricing to response for frontend synchronization
    let syncedPricing = {
      retailPrice: chosenRate.RetailPrice,
      taxAmount: 0,
      taxRate: 0,
      totalAmount: chosenRate.RetailPrice,
    };
    if (contractId) {
      const updatedRow = await db.query(
        "SELECT tax_rate, amount, retail_price, tax_amount FROM contracts WHERE id = $1",
        [contractId],
      );
      if (updatedRow.rows.length > 0) {
        const c = updatedRow.rows[0];
        syncedPricing = {
          retailPrice: parseFloat(c.retail_price) || chosenRate.RetailPrice,
          taxAmount: parseFloat(c.tax_amount) || 0,
          taxRate: parseFloat(c.tax_rate) || 0,
          totalAmount: parseFloat(c.amount) || chosenRate.RetailPrice,
        };
      }
    }

    const responseBody = {
      ...appResult.data,
      _rateUsed: chosenRate,
      pricing: syncedPricing,
      galt_submitted_at: new Date().toISOString(),
      expires_in_seconds: 180,
    };

    return res.status(appResult.ok ? 200 : appResult.status).json(responseBody);
  } catch (error) {
    console.error("Error in submitFullApp:", error);
    if (req.body.contractId) {
      await db
        .query(
          "UPDATE contracts SET galt_sync_status = 'failed' WHERE id = $1",
          [req.body.contractId],
        )
        .catch(console.error);
    }
    return res.status(500).json({
      message: "Failed to complete GALT application flow",
      error: error.message,
    });
  }
};

/**
 * POST /api/galt/apppdf  â€” reprint PDF by ApplicationID
 */
export const getAppPdf = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/apppdf.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt apppdf API:", error);
    return res.status(500).json({
      message: "Failed to retrieve application PDF from Galt API",
      error: error.message,
    });
  }
};

/**
 * POST /api/galt/void  â€” void a contract by ApplicationID
 */
export const voidApp = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/void.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt void API:", error);
    return res.status(500).json({
      message: "Failed to void application in Galt API",
      error: error.message,
    });
  }
};

/**
 * POST /api/galt/vincheck
 */
export const checkVin = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/vincheck.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt vincheck API:", error);
    return res.status(500).json({
      message: "Failed to perform VIN check with Galt API",
      error: error.message,
    });
  }
};

/**
 * GET /api/galt/expiry-status/:contractId
 * Returns the expiration status and seconds remaining of the 3-minute payment window.
 */
export const getGaltExpiryStatus = async (req, res) => {
  const { contractId } = req.params;
  try {
    const result = await db.query(
      `SELECT id, status, galt_sync_status, galt_submitted_at, galt_application_id, galt_contract_no
       FROM contracts WHERE id = $1`,
      [contractId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Contract not found" });
    }

    const contract = result.rows[0];

    // If already paid, it never expires
    if (contract.status === "paid") {
      return res.json({
        contractId: contract.id,
        status: "paid",
        galt_sync_status: contract.galt_sync_status,
        is_expired: false,
        seconds_remaining: 9999,
      });
    }

    // If voided or no active GALT app
    if (
      contract.galt_sync_status === "voided" ||
      (!contract.galt_application_id && !contract.galt_contract_no)
    ) {
      return res.json({
        contractId: contract.id,
        status: contract.status,
        galt_sync_status: "voided",
        is_expired: true,
        seconds_remaining: 0,
      });
    }

    if (!contract.galt_submitted_at) {
      return res.json({
        contractId: contract.id,
        status: contract.status,
        galt_sync_status: contract.galt_sync_status,
        is_expired: false,
        seconds_remaining: 180,
      });
    }

    const submittedMs = new Date(contract.galt_submitted_at).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.floor((nowMs - submittedMs) / 1000);
    const secondsRemaining = Math.max(0, 180 - elapsedSeconds);

    if (secondsRemaining <= 0) {
      // Trigger void & cleanup immediately
      await voidAndCleanupContract(
        contract.id,
        "Expiry status query (0 seconds remaining)",
      );
      return res.json({
        contractId: contract.id,
        status: contract.status,
        galt_sync_status: "voided",
        is_expired: true,
        seconds_remaining: 0,
      });
    }

    return res.json({
      contractId: contract.id,
      status: contract.status,
      galt_sync_status: contract.galt_sync_status,
      galt_submitted_at: contract.galt_submitted_at,
      is_expired: false,
      seconds_remaining: secondsRemaining,
    });
  } catch (error) {
    console.error("Error in getGaltExpiryStatus:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/galt/standard-rate
 */
export const getStandardRate = async (req, res) => {
  try {
    const { data, ok, status } = await galtFetch("/rate.aspx", req.body);
    return res.status(ok ? 200 : status).json(data);
  } catch (error) {
    console.error("Error calling Galt standard rate API:", error);
    return res.status(500).json({
      message: "Failed to retrieve standard rate from Galt API",
      error: error.message,
    });
  }
};

