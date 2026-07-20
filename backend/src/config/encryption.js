import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey() {
  const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'boat_lift_protection_master_secret_key_2026';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypt a text string using AES-256-GCM
 * @param {string} text 
 * @returns {string} Base64 encoded string containing iv, tag, and ciphertext
 */
export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Package IV, AuthTag, and Ciphertext together as hex separated by colons
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 * @param {string} cipherText 
 * @returns {string} Decrypted original text
 */
export function decrypt(cipherText) {
  if (!cipherText) return '';
  
  // If text doesn't match iv:tag:encrypted format, assume it's unencrypted fallback
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    return cipherText;
  }

  try {
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const key = getMasterKey();

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[Encryption] Decryption failed, returning raw string:', err.message);
    return cipherText;
  }
}
