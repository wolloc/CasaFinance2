import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPublicSupabaseConfig } from './supabaseConfig.js';

const config = readPublicSupabaseConfig(import.meta.env);

export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabaseConfigurationError = config
  ? null
  : 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.';
