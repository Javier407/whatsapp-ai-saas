import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit nonce for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * masterKey must be exactly 32 bytes (can be hex-encoded or raw UTF-8 padded).
 * Returns base64-encoded: iv (12 bytes) || ciphertext || authTag (16 bytes)
 */
export function encrypt(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString('base64');
}

/**
 * Decrypts a value previously encrypted with `encrypt`.
 */
export function decrypt(ciphertext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(buf.length - TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function deriveKey(masterKey: string): Buffer {
  const raw = Buffer.from(masterKey, 'utf8');
  if (raw.length >= 32) return raw.subarray(0, 32);
  // Pad to 32 bytes if shorter (validation in config.ts prevents < 32 bytes)
  return Buffer.concat([raw, Buffer.alloc(32 - raw.length)]);
}
