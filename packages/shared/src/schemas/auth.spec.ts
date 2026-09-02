import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  passwordStrength,
  registerSchema,
  resetPasswordSchema,
} from './auth';

describe('passwordSchema', () => {
  const valid = 'CorrectHorseBattery1!';

  it('accepts a strong password', () => {
    expect(passwordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(passwordSchema.safeParse('Short1!').success).toBe(false);
  });

  it('rejects passwords missing a character class', () => {
    expect(passwordSchema.safeParse('lowercaseonly123!').success).toBe(false);
    expect(passwordSchema.safeParse('UPPERCASEONLY123!').success).toBe(false);
    expect(passwordSchema.safeParse('NoSymbols12345').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('trims, lowercases and validates', () => {
    expect(emailSchema.parse('  User@Example.COM ')).toBe('user@example.com');
  });

  it('rejects invalid emails', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration input', () => {
    const out = registerSchema.parse({
      email: 'user@example.com',
      password: 'CorrectHorseBattery1!',
      name: 'Jane Doe',
      acceptTerms: true,
    });
    expect(out.marketingOptIn).toBe(false);
  });

  it('requires terms to be accepted', () => {
    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'CorrectHorseBattery1!',
        name: 'Jane Doe',
        acceptTerms: false,
      }).success,
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials and optional mfa code', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x' })).toMatchObject({ remember: true });
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', mfaCode: '123456' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed mfa code', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', mfaCode: '12ab' }).success).toBe(
      false,
    );
  });
});

describe('forgotPasswordSchema', () => {
  it('validates an email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema / changePasswordSchema', () => {
  it('rejects a confirm-password mismatch', () => {
    expect(
      resetPasswordSchema.safeParse({
        token: '012345678901234567890',
        password: 'CorrectHorseBattery1!',
        confirmPassword: 'DifferentHorse2!',
      }).success,
    ).toBe(false);
  });

  it('accepts a matching pair', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'OldPass1!',
        password: 'CorrectHorseBattery1!',
        confirmPassword: 'CorrectHorseBattery1!',
      }).success,
    ).toBe(true);
  });
});

describe('passwordStrength', () => {
  it('scores empty passwords as very weak', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('').label).toBe('Very weak');
  });

  it('scores a strong password as excellent', () => {
    const { score, label } = passwordStrength('CorrectHorseBattery1!');
    expect(score).toBe(4);
    expect(label).toBe('Excellent');
  });

  it('is monotonic in length', () => {
    const short = passwordStrength('aA1!').bits;
    const long = passwordStrength('aA1!aA1!aA1!aA1!aA1!aA1!').bits;
    expect(long).toBeGreaterThan(short);
  });
});
