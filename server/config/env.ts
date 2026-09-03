export type AppEnvironment = 'development' | 'staging' | 'production' | 'test';

export interface AppConfig {
  environment: AppEnvironment;
  port: number;
  commitSha: string;
  databaseUrl?: string;
  supabaseUrl?: string;
  geminiApiKey?: string;
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
    geminiApiKey: source.GEMINI_API_KEY
  };

  if (config.environment === 'production' && (!config.databaseUrl || !config.supabaseUrl)) {
    throw new Error('DATABASE_URL e SUPABASE_URL sao obrigatorias em production.');
  }
  return config;
}
