import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { friendlyAuthError } from '../auth/authErrors.js';
import { supabase, supabaseConfigurationError } from '../lib/supabase.js';

type Credentials = { email: string; password: string };
type AuthResult = { success: boolean; confirmationRequired?: boolean };

type SupabaseAuthValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  signIn: (credentials: Credentials) => Promise<AuthResult>;
  signUp: (credentials: Credentials) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const SupabaseAuthContext = createContext<SupabaseAuthValue | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(supabaseConfigurationError);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      setSession(data.session);
      if (sessionError) setError(friendlyAuthError(sessionError));
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const run = async (operation: 'signIn' | 'signUp', credentials: Credentials): Promise<AuthResult> => {
    if (!supabase) return { success: false };
    setIsSubmitting(true);
    setError(null);
    try {
      const response = operation === 'signIn'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
      if (response.error) throw response.error;
      return { success: true, confirmationRequired: operation === 'signUp' && !response.data.session };
    } catch (authError) {
      setError(friendlyAuthError(authError));
      return { success: false };
    } finally {
      setIsSubmitting(false);
    }
  };

  const value = useMemo<SupabaseAuthValue>(() => ({
    session,
    user: session?.user ?? null,
    isLoading,
    isSubmitting,
    error,
    signIn: (credentials) => run('signIn', credentials),
    signUp: (credentials) => run('signUp', credentials),
    signOut: async () => {
      if (!supabase) return;
      setIsSubmitting(true);
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(friendlyAuthError(signOutError));
      setIsSubmitting(false);
    },
    clearError: () => setError(null),
  }), [session, isLoading, isSubmitting, error]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return context;
}
