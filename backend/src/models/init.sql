-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'technician',
  refresh_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add refresh_token column if upgrading from older schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  technician_id INTEGER REFERENCES users(id),
  service_plan VARCHAR(255) NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, signed, paid
  stripe_payment_id VARCHAR(255),
  signature_name VARCHAR(255),
  technician_name VARCHAR(255),
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS technician_name VARCHAR(255);

-- NOTE: Default user seeding is handled by initDb.js using runtime bcrypt hashing.
-- Do NOT add static password hashes here.
