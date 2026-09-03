declare module '@supabase/supabase-js' {
  export type User = { id: string; email?: string };
  export type Session = { user: User; access_token: string };
  type AuthResponse = { data: { session: Session | null }; error: Error | null };
  export type SupabaseClient = {
    auth: {
      getSession(): Promise<AuthResponse>;
      onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe(): void } } };
      signInWithPassword(credentials: { email: string; password: string }): Promise<AuthResponse>;
      signUp(credentials: { email: string; password: string }): Promise<AuthResponse>;
      signOut(): Promise<{ error: Error | null }>;
    };
  };
  export function createClient(url: string, key: string, options?: object): SupabaseClient;
}
