import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { base32Decode, base32Encode } from './crypto.util';

export interface TotpOptions {
  digits: number;
  period: number;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
}

export const DEFAULT_TOTP_OPTIONS: TotpOptions = { digits: 6, period: 30, algorithm: 'SHA1' };

/** Fresh 160-bit TOTP seed in base32, the size RFC 4226 recommends for SHA-1. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number, options: TotpOptions): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(options.algorithm.toLowerCase(), secret).update(buffer).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);
  return (binary % 10 ** options.digits).toString().padStart(options.digits, '0');
}

export function totpCounter(atMs = Date.now(), period = DEFAULT_TOTP_OPTIONS.period): number {
  return Math.floor(atMs / 1000 / period);
}

export function generateTotp(
  base32Secret: string,
  atMs = Date.now(),
  options: TotpOptions = DEFAULT_TOTP_OPTIONS,
): string {
  return hotp(base32Decode(base32Secret), totpCounter(atMs, options.period), options);
}

export interface TotpVerification {
  valid: boolean;
  /** Counter the code matched, so replays of the same step can be rejected. */
  counter: number | null;
}

/**
 * Verify a code, tolerating ±`window` steps of clock drift. Comparison is
 * constant-time and the matching counter is returned so callers can persist it
 * and refuse to accept the same step twice.
 */
export function verifyTotp(
  base32Secret: string,
  code: string,
  options: TotpOptions = DEFAULT_TOTP_OPTIONS,
  window = 1,
  atMs = Date.now(),
): TotpVerification {
  const normalised = code.replace(/\s+/gu, '');
  if (!new RegExp(`^\\d{${options.digits}}$`, 'u').test(normalised))
    return { valid: false, counter: null };

  const secret = base32Decode(base32Secret);
  const current = totpCounter(atMs, options.period);
  const candidate = Buffer.from(normalised, 'utf8');

  for (let drift = -window; drift <= window; drift += 1) {
    const counter = current + drift;
    if (counter < 0) continue;
    const expected = Buffer.from(hotp(secret, counter, options), 'utf8');
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
      return { valid: true, counter };
    }
  }
  return { valid: false, counter: null };
}

/** `otpauth://` URI consumed by authenticator apps and rendered as a QR code. */
export function buildOtpAuthUri(params: {
  issuer: string;
  account: string;
  secret: string;
  options?: TotpOptions;
}): string {
  const options = params.options ?? DEFAULT_TOTP_OPTIONS;
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.account)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: options.algorithm,
    digits: String(options.digits),
    period: String(options.period),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/** Ten single-use recovery codes in `xxxx-xxxx` form. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex');
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}
