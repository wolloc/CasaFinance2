export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function readPublicSupabaseConfig(
  env: Record<string, string | boolean | undefined>,
): PublicSupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof publishableKey !== 'string' || !url || !publishableKey) return null;
  return { url, publishableKey };
}
