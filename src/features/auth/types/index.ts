import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

export type AuthMode = 'signin' | 'signup' | 'magiclink';
