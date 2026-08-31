import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
});

const processEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

// Safe parsed env
const parsed = envSchema.safeParse(processEnv);

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: parsed.success ? parsed.data.NEXT_PUBLIC_SUPABASE_URL : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.success ? parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'),
  isValid: parsed.success,
};
