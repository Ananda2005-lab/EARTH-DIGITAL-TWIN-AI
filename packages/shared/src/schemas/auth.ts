import { z } from 'zod';

/**
 * Password policy: 12+ characters with mixed classes. Enforced identically on the
 * client (instant feedback) and the API (authoritative).
 */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Maximum 128 characters')
  .refine((v) => /[a-z]/.test(v), 'Add a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Add an uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Add a number')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Add a symbol');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, 'Enter your name').max(80),
  organisation: z.string().trim().max(120).optional(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  marketingOptIn: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(128),
  remember: z.boolean().default(true),
  mfaCode: z
    .string()
    .regex(/^\d{6}$/, 'Enter the 6-digit code')
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const oauthCallbackSchema = z.object({
  code: z.string().min(4),
  state: z.string().min(8),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.string().url().max(512).nullable().optional(),
  organisation: z.string().trim().max(120).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  locale: z.string().min(2).max(12).optional(),
  timezone: z.string().min(2).max(64).optional(),
});

export const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  temperatureUnit: z.enum(['celsius', 'fahrenheit']).optional(),
  mapBasemap: z.string().min(1).max(48).optional(),
  defaultLayers: z.array(z.string().min(1).max(48)).max(40).optional(),
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  labelDensity: z.enum(['minimal', 'balanced', 'detailed']).optional(),
  autoRotateGlobe: z.boolean().optional(),
  telemetryOptIn: z.boolean().optional(),
  emailDigest: z.enum(['off', 'daily', 'weekly']).optional(),
  hazardAlertRadiusKm: z.number().int().min(10).max(5000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;

/** Rough entropy estimate (bits) for the password strength meter. */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
} {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;
  const unique = new Set(password).size;
  const bits =
    password.length > 0
      ? Math.round(Math.log2(Math.max(pool, 1)) * Math.min(password.length, unique + 4))
      : 0;
  const score = bits >= 96 ? 4 : bits >= 72 ? 3 : bits >= 52 ? 2 : bits >= 32 ? 1 : 0;
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  return { score, label: labels[score]!, bits };
}
