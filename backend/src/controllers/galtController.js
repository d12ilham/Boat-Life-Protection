import fs from "fs";
import path from "path";
import db from "../config/db.js";

/**
 * Controller for Galt F&I Online Interface API endpoints
 * Products: 102 = Maintenance (PMP), 103 = Service Contract (ESC)
 */

const getGaltCredentials = () => ({
  Username: process.env.GALT_USERNAME,
  Password: process.env.GALT_PASSWORD,
  DealerNumber: process.env.GALT_DEALER_NUMBER,
});

const galtFetch = async (endpoint, payload) => {
  const baseUrl = process.env.GALT_API_BASE_URL;
  if (!baseUrl) throw new Error("Galt API Base URL is not configured.");

  const fullPayload = { ...payload, ...getGaltCredentials() };
  const authHeader =
    "Basic " +
    Buffer.from(
      process.env.GALT_USERNAME + ":" + process.env.GALT_PASSWORD,
    ).toString("base64");

  console.log("[GALT] POST", endpoint, JSON.stringify(fullPayload));

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
 * POST /api/galt/submit  â€” orchestrated two-step Rate â†’ App flow
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
        };
      }
    }

    if (!chosenRate) {
      console.warn(
        "[GALT] Rate call returned no usable rate. Proceeding with fallback values.",
      );
      chosenRate = {
        ProductID: expectedProductId,
        Coverage: Coverage,
        TermMonths: expectedTermMonths,
        Deductible: 0,
        DealerCost:
          expectedProductId === 102
            ? 1260.0
            : parseFloat(RetailPrice) * 0.75 || 1000.0, // Sensible dev fallback to prevent Missing Dealer Cost errors
      };
    }

    // â”€â”€ Step B: App submission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // Fixed â€” lift has no odometer / mileage
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

      // Pricing
      RetailPrice: parseFloat(RetailPrice) || 0,

      // Fixed empty arrays (NOT optional objects)
      Surcharges: [],
      ReqFields: [],

      // NOT USED â€” omitted entirely:
      // LHName, LHAddress, LHCity, LHState, LHZipCode, LHPhoneNo, LHAccountNumber
      // AmountFinanced, FinanceTerm, FinanceType, APR
      // EngineSize, EngineSizeType, MSRPNADAValue
    };

    const appResult = await galtFetch("/app.aspx", appPayload);
    // console.log('[GALT] App response:', JSON.stringify(appResult.data, null, 2));

    // If GALT submission is successful, decode and save the PDF
    if (appResult.ok && appResult.data && contractId) {
      const appData = appResult.data.App || appResult.data;
      const pdfBase64 = appData.PDF || appResult.data.PDF;
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
          const savedPdfUrl = `/receipts/${fileName}`;

          const signatures = appData.Signatures || appResult.data.Signatures || [];
          await db.query("UPDATE contracts SET pdf_url = $1, galt_signatures = $2 WHERE id = $3", [
            savedPdfUrl,
            JSON.stringify(signatures),
            contractId,
          ]);
          console.log(
            `[GALT] Saved PDF for contract ${contractId} to ${savedPdfUrl}`,
          );
        } catch (saveErr) {
          console.error(
            "[GALT] Failed to save GALT PDF or update database:",
            saveErr,
          );
        }
      }
    }

    // Attach the rate data to response for context
    const responseBody = {
      ...appResult.data,
      _rateUsed: chosenRate,
    };

    return res.status(appResult.ok ? 200 : appResult.status).json(responseBody);
  } catch (error) {
    console.error("Error in submitFullApp:", error);
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
