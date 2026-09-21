# Release 1 — triagem do Supabase Security Advisor

**Data:** 2026-09-21  
**Estado:** DEFINIDO para a Release 1

A triagem do Staging antes da homologação final encontrou quatro classes de aviso.

## Corrigido nesta etapa

- `function_search_path_mutable`: os dois trigger functions legados passam a usar `search_path = public, pg_temp`.

## Mantido de propósito

- `household_invitations` com RLS e sem policy direta: a tabela não concede acesso a `public`, `anon` ou `authenticated`; criação/aceite passam pelos RPCs controlados. O estado fail-closed é deliberado.
- RPCs `SECURITY DEFINER` executáveis por `authenticated`: o Casa usa RPCs como superfície de comandos financeiros e de onboarding. Eles continuam sujeitos aos contratos de autenticação/Casa e aos gates de RLS/isolamento do CI. Não devem ser convertidos em massa para `SECURITY INVOKER`.

## Pendente de configuração do ambiente

- **Leaked Password Protection**: o Advisor informa que está desabilitado. O Supabase oferece essa proteção no plano Pro ou superior. Para produção, habilitar se o plano escolhido suportar; isso não altera o domínio financeiro nem deve ser simulado por código do aplicativo.

Essa triagem não transforma warnings genéricos do Advisor em defeitos do domínio. Cada classe precisa ser avaliada contra a arquitetura real antes de qualquer mudança.
