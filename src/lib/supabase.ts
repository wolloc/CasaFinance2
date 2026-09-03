import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from '../config/runtime.js';
import { readPublicSupabaseConfig } from './supabaseConfig.js';

const runtimeConfig = getRuntimeConfig();
const config = readPublicSupabaseConfig({
  VITE_SUPABASE_URL: runtimeConfig.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: runtimeConfig.supabasePublishableKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

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
