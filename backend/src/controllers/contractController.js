import db from '../config/db.js';
import { stampSignaturesOnPdf } from '../services/pdfService.js';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * POST /api/customer-init
 * Initialize Customer and Contract records in the database.
 */
export const initCustomerAndContract = async (req, res) => {
  const { technician_id, customer, contract } = req.body;

  try {
    // 1. Create or Find Customer
    let customerResult = await db.query('SELECT id FROM customers WHERE email = $1', [customer.email]);
    let customerId;

    const legacyName = [customer.first_name, customer.middle_initial ? customer.middle_initial + '.' : '', customer.last_name, customer.suffix].filter(Boolean).join(' ').trim() || 'N/A';
    const legacyAddress = [customer.street_address, customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ').trim() || 'N/A';
    const legacyPhone = customer.home_phone || customer.business_phone || 'N/A';

    if (customerResult.rows.length === 0) {
      const insertCustomer = await db.query(
        `INSERT INTO customers (
          name, address, phone, email,
          first_name, last_name, middle_initial, suffix,
          home_phone, business_phone, street_address, city, state, zip_code
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          legacyName, legacyAddress, legacyPhone, customer.email,
          customer.first_name, customer.last_name, customer.middle_initial, customer.suffix,
          customer.home_phone, customer.business_phone, customer.street_address, customer.city, customer.state, customer.zip_code,
        ]
      );
      customerId = insertCustomer.rows[0].id;
    } else {
      customerId = customerResult.rows[0].id;
      await db.query(
        `UPDATE customers SET
          name=$1, address=$2, phone=$3,
          first_name=$4, last_name=$5, middle_initial=$6, suffix=$7,
          home_phone=$8, business_phone=$9, street_address=$10, city=$11, state=$12, zip_code=$13
         WHERE id=$14`,
        [
          legacyName, legacyAddress, legacyPhone,
          customer.first_name, customer.last_name, customer.middle_initial, customer.suffix,
          customer.home_phone, customer.business_phone, customer.street_address, customer.city, customer.state, customer.zip_code,
          customerId,
        ]
      );
    }

    // 2. Initialize Contract
    // vehicle_status must be 'NEW' or 'USED' (Gary confirmed — not 'N/A')
    const vehicleStatus = ['NEW', 'USED'].includes(contract.vehicle_status) ? contract.vehicle_status : 'NEW';

    const insertContract = await db.query(
      `INSERT INTO contracts (
        customer_id, technician_id, technician_name, service_plan, amount, status,
        serial_number, year, make, model, lift_type, lift_category,
        date_of_sale, in_service_date, mnf_warranty_length,
        vehicle_sale_price, retail_price, vehicle_status,
        current_odometer, odometer_type, term_miles,
        amount_financed, finance_term, apr,
        coverage, contract_type
      )
      VALUES (
        $1,$2,$3,$4,$5,'pending',
        $6,$7,$8,$9,$10,$11,
        $12,$13,$14,
        $15,$16,$17,
        '0','no','999999',
        0,0,0,
        $18, $19
      ) RETURNING id`,
      [
        customerId,
        technician_id || null,
        req.body.technician_name,
        contract.service_plan,
        contract.amount,
        contract.serial_number,
        contract.year ? parseInt(contract.year) : null,
        contract.make,
        contract.model,
        contract.lift_type,
        contract.lift_category,
        contract.date_of_sale || null,
        contract.in_service_date || null,
        contract.mnf_warranty_length ? parseInt(contract.mnf_warranty_length) : 0,
        contract.vehicle_sale_price ? parseFloat(contract.vehicle_sale_price) : 0.0,
        contract.retail_price ? parseFloat(contract.retail_price) : 0.0,
        vehicleStatus,
        contract.coverage || null,
        contract.contract_type || null,
      ]
    );

    res.status(200).json({
      message: 'Contract initialized',
      customer_id: customerId,
      contract_id: insertContract.rows[0].id,
    });
  } catch (error) {
    console.error('Error in initCustomerAndContract', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * POST /api/contract-signature
 */
export const signContract = async (req, res) => {
  const { contract_id, signature_name } = req.body;
  try {
    await db.query(
      "UPDATE contracts SET signature_name = $1, status = 'signed' WHERE id = $2",
      [signature_name, contract_id]
    );

    // Dynamic PDF signature placement
    const contractResult = await db.query(
      "SELECT pdf_url, galt_signatures, technician_name FROM contracts WHERE id = $1",
      [contract_id]
    );

    if (contractResult.rows.length > 0) {
      const contract = contractResult.rows[0];
      const { pdf_url, galt_signatures, technician_name } = contract;

      if (pdf_url && galt_signatures) {
        // Resolve absolute PDF path
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const receiptsDir = path.join(__dirname, '..', '..', 'public', 'receipts');
        const pdfPath = path.join(receiptsDir, path.basename(pdf_url));

        let signatures = [];
        try {
          signatures = typeof galt_signatures === 'string' ? JSON.parse(galt_signatures) : galt_signatures;
        } catch (e) {
          console.error('[signContract] Failed to parse signatures JSON:', e);
        }

        if (Array.isArray(signatures) && signatures.length > 0) {
          await stampSignaturesOnPdf(pdfPath, signatures, signature_name, technician_name);
        }
      }
    }

    res.json({ message: 'Contract digitally signed successfully' });
  } catch (error) {
    console.error('Error in signContract', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/contract/:id
 */
export const getContract = async (req, res) => {
  const { id } = req.params;
  try {
    const contractResult = await db.query(
      `SELECT c.*, cust.name as customer_name, cust.email as customer_email, cust.address as customer_address, cust.phone as customer_phone,
              cust.first_name, cust.last_name, cust.middle_initial, cust.suffix, cust.home_phone, cust.business_phone, cust.street_address, cust.city, cust.state, cust.zip_code
       FROM contracts c
       JOIN customers cust ON c.customer_id = cust.id
       WHERE c.id = $1`,
      [id]
    );
    if (contractResult.rows.length === 0) return res.status(404).json({ message: 'Contract not found' });
    res.json(contractResult.rows[0]);
  } catch (error) {
    console.error('Error in getContract', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
