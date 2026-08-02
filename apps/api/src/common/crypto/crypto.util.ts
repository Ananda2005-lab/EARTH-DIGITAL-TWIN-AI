import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

/** URL-safe opaque secret. 32 bytes ≈ 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest — used for token/API-key lookups (never for passwords). */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Constant-time string comparison. Both sides are hashed first so unequal
 * lengths cannot leak through `timingSafeEqual`'s length check.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}

const AES_ALGORITHM = 'aes-256-gcm';
const KEY_SALT = 'edt-mfa-secret-v1';

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, KEY_SALT, 32);
}

/**
 * Envelope-encrypt a small secret (TOTP seed) with AES-256-GCM.
 * Format: `v1.<iv>.<authTag>.<ciphertext>`, all base64url.
 */
export function encryptSecret(plaintext: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(AES_ALGORITHM, deriveKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(envelope: string, key: string): string {
  const [version, ivPart, tagPart, payloadPart] = envelope.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !payloadPart) {
    throw new Error('Malformed encrypted secret envelope');
  }
  const decipher = createDecipheriv(AES_ALGORITHM, deriveKey(key), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payloadPart, 'base64url')), decipher.final()]).toString('utf8');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 without padding (the format authenticator apps expect). */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/u, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
