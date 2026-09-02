import {
  base32Decode,
  base32Encode,
  constantTimeEquals,
  decryptSecret,
  encryptSecret,
  randomToken,
  sha256,
} from './crypto.util';

describe('randomToken', () => {
  it('is URL-safe and the requested length in bytes', () => {
    const token = randomToken(32);
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/u);
  });

  it('is unique across calls', () => {
    expect(randomToken(32)).not.toBe(randomToken(32));
  });
});

describe('sha256', () => {
  it('matches a known digest', () => {
    expect(sha256('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});

describe('constantTimeEquals', () => {
  it('compares equal strings truthy and unequal falsy', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', '')).toBe(false);
  });
});

describe('encryptSecret / decryptSecret', () => {
  const key = 'a-strong-user-secret';

  it('round-trips the plaintext', () => {
    const envelope = encryptSecret('JBSWY3DPEHPK3PXP', key);
    expect(envelope.startsWith('v1.')).toBe(true);
    expect(decryptSecret(envelope, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('is non-deterministic (fresh IV every call)', () => {
    expect(encryptSecret('same', key)).not.toBe(encryptSecret('same', key));
  });

  it('fails on a wrong key or a tampered envelope', () => {
    const envelope = encryptSecret('seed', key);
    expect(() => decryptSecret(envelope, 'wrong-key')).toThrow();
    expect(() => decryptSecret(envelope.replace(/^v1\./, 'v2.'), key)).toThrow();
    expect(() => decryptSecret('garbage', key)).toThrow();
  });
});

describe('base32', () => {
  it('matches the RFC 4648 test vectors', () => {
    expect(base32Encode(Buffer.from(''))).toBe('');
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(base32Encode(Buffer.from('foo'))).toBe('MZXW6');
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });

  it('round-trips arbitrary bytes, ignoring padding', () => {
    for (const len of [1, 5, 10, 20, 32]) {
      const input = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + len) % 256));
      const encoded = base32Encode(input);
      expect(Buffer.compare(base32Decode(`${encoded}====`), input)).toBe(0);
    }
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base32Decode('ABC1')).toThrow('Invalid base32 character');
  });
});
