import type { AppConfig } from '../config/env.js';

export interface PublicRuntimeConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export function renderRuntimeConfig(config: Pick<AppConfig, 'supabaseUrl' | 'supabasePublishableKey'>): string {
  const publicConfig: PublicRuntimeConfig = {
    supabaseUrl: config.supabaseUrl ?? '',
    supabasePublishableKey: config.supabasePublishableKey ?? ''
  };
  const serialized = JSON.stringify(publicConfig)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return `window.__CASA_FINANCE_CONFIG__ = Object.freeze(${serialized});`;
}
