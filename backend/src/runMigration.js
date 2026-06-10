import db from './config/db.js';

async function run() {
  try {
    console.log('Running database migration...');

    // Alter customers table
    await db.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS middle_initial VARCHAR(10),
      ADD COLUMN IF NOT EXISTS suffix VARCHAR(50),
      ADD COLUMN IF NOT EXISTS home_phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS business_phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS street_address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(255),
      ADD COLUMN IF NOT EXISTS state VARCHAR(255),
      ADD COLUMN IF NOT EXISTS zip_code VARCHAR(50);
    `);
    console.log('âœ… Altered customers table.');

    // Alter contracts table
    await db.query(`
      ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255),
      ADD COLUMN IF NOT EXISTS year INTEGER,
      ADD COLUMN IF NOT EXISTS make VARCHAR(255),
      ADD COLUMN IF NOT EXISTS model VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lift_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lift_category VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_of_sale DATE,
      ADD COLUMN IF NOT EXISTS in_service_date DATE,
      ADD COLUMN IF NOT EXISTS mnf_warranty_length INTEGER,
      ADD COLUMN IF NOT EXISTS vehicle_sale_price NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS retail_price NUMERIC(10, 2),
      ADD COLUMN IF NOT EXISTS vehicle_status VARCHAR(50) DEFAULT 'N/A',
      ADD COLUMN IF NOT EXISTS current_odometer VARCHAR(50) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS odometer_type VARCHAR(50) DEFAULT 'no',
      ADD COLUMN IF NOT EXISTS term_miles VARCHAR(50) DEFAULT '999999',
      ADD COLUMN IF NOT EXISTS amount_financed NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS finance_term INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS apr NUMERIC(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS galt_signatures JSONB;
    `);
    console.log('âœ… Altered contracts table.');

    // Create qbo_tokens table
    await db.query(`
      CREATE TABLE IF NOT EXISTS qbo_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        realm_id TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('âœ… Created qbo_tokens table.');

    console.log('âœ… Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('âŒ Migration failed:', err);
    process.exit(1);
  }
}

run();