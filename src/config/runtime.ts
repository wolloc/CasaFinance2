export interface PublicRuntimeConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

declare global {
  interface Window {
    __CASA_FINANCE_CONFIG__?: PublicRuntimeConfig;
  }
}

export function getRuntimeConfig(): PublicRuntimeConfig {
  return window.__CASA_FINANCE_CONFIG__ ?? {
    supabaseUrl: '',
    supabasePublishableKey: ''
  };
}
