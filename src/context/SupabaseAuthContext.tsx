import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { friendlyAuthError } from '../auth/authErrors.js';
import { supabase, supabaseConfigurationError } from '../lib/supabase.js';
import { bootstrapHousehold, findExistingHousehold, type BootstrapHouseholdResult } from '../auth/householdBootstrap.js';
import { acceptHouseholdInvitation, createHouseholdInvitation, friendlyInvitationError, type AcceptInvitationResult, type HouseholdInvitation } from '../auth/householdInvitations.js';

type Credentials = { email: string; password: string };
type AuthResult = { success: boolean; confirmationRequired?: boolean };

type SupabaseAuthValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  household: { id: string; name: string } | null;
  householdMembers: Array<{ id: string; profile_id: string; role: 'owner' | 'member' | 'viewer'; display_name: string }>;
  householdLoading: boolean;
  createHousehold: (householdName: string, displayName: string) => Promise<BootstrapHouseholdResult | null>;
  createInvitation: (invitedEmail?: string) => Promise<HouseholdInvitation | null>;
  acceptInvitation: (token: string) => Promise<AcceptInvitationResult | null>;
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
  const [household, setHousehold] = useState<{ id: string; name: string } | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Array<{ id: string; profile_id: string; role: 'owner' | 'member' | 'viewer'; display_name: string }>>([]);
  const [householdRefreshVersion, setHouseholdRefreshVersion] = useState(0);
  const [householdLoading, setHouseholdLoading] = useState(false);
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

  useEffect(() => {
    if (!supabase || !session) {
      setHousehold(null);
      setHouseholdMembers([]);
      setHouseholdLoading(false);
      return;
    }
    let mounted = true;
    setHouseholdLoading(true);
    findExistingHousehold(supabase, session)
      .then((existingHousehold) => { if (mounted) setHousehold(existingHousehold); })
      .catch((householdError) => { if (mounted) setError('Não foi possível verificar sua Casa. Tente novamente.'); })
      .finally(() => { if (mounted) setHouseholdLoading(false); });
    supabase.from('household_members')
      .select('id, household_id, profile_id, role, profiles(display_name)')
      .eq('profile_id', session.user.id)
      .is('deactivated_at', null)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!mounted || !data) return;
        const membership = data as { household_id: string };
        const response = await supabase.from('household_members')
          .select('id, profile_id, role, profiles(display_name)')
          .eq('household_id', membership.household_id)
          .is('deactivated_at', null)
          .order('joined_at');
        if (!mounted || response.error) return;
        setHouseholdMembers((response.data ?? []).map((member) => ({
          id: member.id,
          profile_id: member.profile_id,
          role: member.role as 'owner' | 'member' | 'viewer',
          display_name: ((Array.isArray(member.profiles) ? member.profiles[0] : member.profiles) as { display_name?: string } | null)?.display_name ?? 'Membro',
        })));
      })
      ;
    return () => { mounted = false; };
  }, [session, householdRefreshVersion]);

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
    household,
    householdLoading,
    householdMembers,
    createHousehold: async (householdName, displayName) => {
      if (!supabase || !session) {
        setError('Sessão expirada. Entre novamente para continuar.');
        return null;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await bootstrapHousehold(supabase, session, householdName, displayName);
        setHousehold(await findExistingHousehold(supabase, session));
        setHouseholdRefreshVersion((version) => version + 1);
        return result;
      } catch (householdError) {
        setError(householdError instanceof Error && householdError.message.includes('Sessão')
          ? householdError.message
          : 'Não foi possível criar sua Casa agora. Tente novamente.');
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    createInvitation: async (invitedEmail) => {
      if (!supabase || !session) {
        setError('Sessão expirada. Entre novamente para continuar.');
        return null;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        return await createHouseholdInvitation(supabase, session, invitedEmail);
      } catch (invitationError) {
        setError(friendlyInvitationError(invitationError));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    acceptInvitation: async (token) => {
      if (!supabase || !session) {
        setError('Sessão expirada. Entre novamente para continuar.');
        return null;
      }
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await acceptHouseholdInvitation(supabase, session, token);
        setHousehold(await findExistingHousehold(supabase, session));
        setHouseholdRefreshVersion((version) => version + 1);
        return result;
      } catch (invitationError) {
        setError(friendlyInvitationError(invitationError));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
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
  }), [session, isLoading, isSubmitting, error, household, householdMembers, householdLoading]);

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return context;
}
