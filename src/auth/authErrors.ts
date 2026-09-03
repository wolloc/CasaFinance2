const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar.'],
  [/user already registered/i, 'Já existe uma conta com este e-mail.'],
  [/password should be at least/i, 'A senha deve ter pelo menos 6 caracteres.'],
  [/unable to validate email|invalid email/i, 'Digite um e-mail válido.'],
  [/rate limit|too many requests/i, 'Muitas tentativas. Aguarde um pouco e tente novamente.'],
];

export function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return AUTH_MESSAGES.find(([pattern]) => pattern.test(raw))?.[1]
    ?? 'Não foi possível autenticar agora. Tente novamente.';
}
