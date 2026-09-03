export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';

export interface AppConfig {
  environment: AppEnvironment;
  port: number;
  commitSha: string;
  databaseUrl?: string;
  supabaseUrl?: string;
  geminiApiKey?: string;
  appUrl?: string;
  corsOrigins: readonly string[];
  enforceHttps: boolean;
}

const environments: readonly AppEnvironment[] = ['development', 'staging', 'production', 'test'];

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = source.APP_ENV ?? source.NODE_ENV ?? 'development';
  if (!environments.includes(environment as AppEnvironment)) {
    throw new Error(`APP_ENV invalido: ${environment}. Use development, staging, production ou test.`);
  }

  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT deve ser um inteiro entre 1 e 65535.');

  const config: AppConfig = {
    environment: environment as AppEnvironment,
    port,
    commitSha: source.COMMIT_SHA ?? 'local',
    databaseUrl: source.DATABASE_URL,
    supabaseUrl: source.SUPABASE_URL,
    geminiApiKey: source.GEMINI_API_KEY,
    appUrl: source.APP_URL,
    corsOrigins: (source.CORS_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
    enforceHttps: source.ENFORCE_HTTPS === 'true' || environment === 'production'
  };

  if ((config.environment === 'staging' || config.environment === 'production') && (!config.databaseUrl || !config.supabaseUrl || !config.appUrl)) {
    throw new Error('DATABASE_URL, SUPABASE_URL e APP_URL sao obrigatorias em staging e production.');
  }
  if (config.enforceHttps && !config.appUrl) throw new Error('APP_URL e obrigatoria quando ENFORCE_HTTPS esta ativo.');
  if (config.appUrl) validateHttpsUrl(config.appUrl, config.environment);
  config.corsOrigins.forEach((origin) => validateHttpsUrl(origin, config.environment));
  if (config.appUrl && !config.corsOrigins.includes(config.appUrl)) config.corsOrigins = [config.appUrl, ...config.corsOrigins];
  return config;
}

function validateHttpsUrl(value: string, environment: AppEnvironment): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL de ambiente invalida: ${value}`);
  }
  if ((environment === 'staging' || environment === 'production') && url.protocol !== 'https:') {
    throw new Error('APP_URL e CORS_ORIGINS devem usar HTTPS fora do desenvolvimento.');
  }
}
