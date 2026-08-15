import { z } from 'zod';
import { LIMITS } from '../constants';

export const registerSchema = z.object({
  email: z.email('invalid_email').max(254),
  // The positional message is the stable key for the type/missing error, so an
  // absent field returns `required` instead of a raw English zod string.
  password: z
    .string('required')
    .min(LIMITS.auth.passwordMin, 'password_min')
    .max(LIMITS.auth.passwordMax, 'password_max')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).*$/, 'password_weak'),
  fullName: z
    .string('required')
    .trim()
    .min(LIMITS.auth.fullNameMin, 'full_name_min')
    .max(LIMITS.auth.fullNameMax, 'full_name_max'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('invalid_email').max(254),
  password: z.string('required').min(1, 'required').max(LIMITS.auth.passwordMax),
});
export type LoginInput = z.infer<typeof loginSchema>;
