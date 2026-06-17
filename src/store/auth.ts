import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  initialized: boolean;
  /** One-shot flag set when an account is confirmed for the first time, consumed
   *  by the welcome screen to fire the account-created celebration. */
  justCreated: boolean;
  setSession: (s: Session | null) => void;
  setInitialized: (v: boolean) => void;
  setJustCreated: (v: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  justCreated: false,
  setSession: (session) => set({ session }),
  setInitialized: (initialized) => set({ initialized }),
  setJustCreated: (justCreated) => set({ justCreated }),
}));
