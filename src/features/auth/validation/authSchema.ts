import { z } from 'zod';

export const emailPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const magicLinkSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export type EmailPasswordInput = z.infer<typeof emailPasswordSchema>;
export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
