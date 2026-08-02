import { z } from 'zod';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from '@edt/shared';
import { zodDto } from 'src/common/zod/zod-dto';

/**
 * DTOs are thin subclasses of the shared Zod schemas.
 *
 * Declaring them as real classes (rather than type aliases) is deliberate: Nest
 * emits the class into `design:paramtypes`, which is how the global
 * `ZodValidationPipe` discovers the schema and how Swagger resolves the body.
 */

const refreshPartialSchema = refreshSchema.partial();

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(512) });
export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6)
    .max(16)
    .describe('6-digit TOTP code or an xxxx-xxxx recovery code'),
});
export const unlinkProviderSchema = z.object({ provider: z.enum(['google', 'github']) });

export class RegisterDto extends zodDto(registerSchema) {}
export class LoginDto extends zodDto(loginSchema) {}
export class RefreshDto extends zodDto(refreshPartialSchema) {}
export class ForgotPasswordDto extends zodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends zodDto(resetPasswordSchema) {}
export class ChangePasswordDto extends zodDto(changePasswordSchema) {}
export class VerifyEmailDto extends zodDto(verifyEmailSchema) {}
export class ResendVerificationDto extends zodDto(resendVerificationSchema) {}
export class MfaCodeDto extends zodDto(mfaCodeSchema) {}
export class UnlinkProviderDto extends zodDto(unlinkProviderSchema) {}
