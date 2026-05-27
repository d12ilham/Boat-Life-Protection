import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

console.log("DB Config: ", {
  "Database: ": process.env.DB_NAME,
  "Password: ": process.env.DB_PASSWORD,
  "Username: ": process.env.DB_USER,
  "Host: ": process.env.DB_HOST,
  "Port: ": process.env.DB_PORT,
});

// Run schema DDL (tables + ALTER) — no seed inserts in the SQL file
const sql = readFileSync(join(__dirname, "models", "init.sql"), "utf8");

try {
  await pool.query(sql);
  console.log("✅ Schema created / updated.");

  // Seed default admin user with a proper bcrypt hash
  const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || "password";
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ('vendor_admin', $1, 'admin')
     ON CONFLICT (username) DO UPDATE SET password_hash = $1`,
    [hash],
  );

  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ('demo_vendor', $1, 'vendor')
     ON CONFLICT (username) DO UPDATE SET password_hash = $1`,
    [hash],
  );

  console.log(`✅ Default users seeded:`);
  console.log(`   - Admin: vendor_admin / ${DEFAULT_PASSWORD}`);
  console.log(`   - Vendor: demo_vendor / ${DEFAULT_PASSWORD}`);
  console.log("✅ Database initialized successfully.");
} catch (err) {
  console.error("❌ Failed to initialize database:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
