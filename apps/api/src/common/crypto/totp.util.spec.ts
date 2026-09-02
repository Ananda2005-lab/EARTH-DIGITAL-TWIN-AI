import {
  buildOtpAuthUri,
  generateRecoveryCodes,
  generateTotp,
  generateTotpSecret,
  totpCounter,
  verifyTotp,
} from './totp.util';

/** RFC 6238 shared test secret "12345678901234567890" in base32. */
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('generateTotpSecret', () => {
  it('produces a 32-character base32 seed', () => {
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(32);
    expect(secret).toMatch(/^[A-Z2-7]+$/u);
  });
});

describe('generateTotp', () => {
  it('matches the RFC 4226 HOTP vectors at fixed counters', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583'];
    expected.forEach((code, counter) => {
      const atMs = counter * 30_000;
      expect(generateTotp(RFC_SECRET, atMs)).toBe(code);
    });
  });
});

describe('verifyTotp', () => {
  it('accepts a valid code at its own counter', () => {
    const atMs = 2 * 30_000;
    const code = generateTotp(RFC_SECRET, atMs);
    const result = verifyTotp(RFC_SECRET, code, undefined, 1, atMs);
    expect(result).toEqual({ valid: true, counter: 2 });
  });

  it('tolerates one step of clock drift', () => {
    const atMs = 5 * 30_000;
    const future = generateTotp(RFC_SECRET, atMs + 30_000);
    const result = verifyTotp(RFC_SECRET, future, undefined, 1, atMs);
    expect(result.valid).toBe(true);
    expect(result.counter).toBe(6);
  });

  it('rejects wrong codes and malformed input', () => {
    const atMs = 1_000_000;
    expect(verifyTotp(RFC_SECRET, '000000', undefined, 1, atMs).valid).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', undefined, 1, atMs).valid).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', undefined, 1, atMs).valid).toBe(false);
  });
});

describe('totpCounter', () => {
  it('floors time into 30s steps from the epoch', () => {
    expect(totpCounter(0)).toBe(0);
    expect(totpCounter(29_999)).toBe(0);
    expect(totpCounter(30_000)).toBe(1);
    expect(totpCounter(1_000_000, 10)).toBe(100);
  });
});

describe('buildOtpAuthUri', () => {
  it('builds an otpauth:// URI', () => {
    const uri = buildOtpAuthUri({
      issuer: 'Earth Twin',
      account: 'user@example.com',
      secret: RFC_SECRET,
    });
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});

describe('generateRecoveryCodes', () => {
  it('returns ten codes in xxxx-xxxx form', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/u);
    }
  });
});
