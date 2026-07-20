import db from './db.js';
import { decrypt } from './encryption.js';

let cache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds cache TTL

export function clearSettingCache() {
  cache = null;
  lastCacheTime = 0;
}

async function loadAllDbSettings() {
  const now = Date.now();
  if (cache && (now - lastCacheTime) < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const result = await db.query('SELECT key, value, is_secret FROM app_settings');
    const settingsMap = {};
    for (const row of result.rows) {
      if (row.value) {
        settingsMap[row.key] = row.is_secret ? decrypt(row.value) : row.value;
      }
    }
    cache = settingsMap;
    lastCacheTime = now;
    return cache;
  } catch (err) {
    console.error('[ConfigResolver] Error querying app_settings from DB:', err.message);
    return {};
  }
}

/**
 * Resolves a setting key:
 * 1. DB setting in app_settings table
 * 2. process.env fallback
 * 3. defaultValue fallback
 */
export async function getSetting(key, defaultValue = '') {
  const dbSettings = await loadAllDbSettings();
  if (dbSettings[key] !== undefined && dbSettings[key] !== null && dbSettings[key] !== '') {
    return dbSettings[key];
  }
  if (process.env[key] !== undefined && process.env[key] !== null && process.env[key] !== '') {
    return process.env[key];
  }
  return defaultValue;
}
