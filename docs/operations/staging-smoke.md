# Smoke de staging

O workflow `Staging smoke` é manual e só se torna uma evidência de homologação quando roda com um projeto Supabase de staging real.

## Configuração única no GitHub

Crie o Environment `staging` no repositório e cadastre **variables**:

- `STAGING_SUPABASE_URL`: URL HTTPS do projeto Supabase de staging.
- `STAGING_SUPABASE_PUBLISHABLE_KEY`: chave pública `sb_publishable_...` do mesmo projeto.

Esses valores são públicos por definição para o navegador. **Não** cadastre service role, secret key, senha do banco ou token administrativo nesse workflow.

## Como executar

Em GitHub Actions, abra `Staging smoke` e use `Run workflow` a partir da `main` que você pretende homologar.

O job somente fica verde se:

1. a configuração pública passar pelo contrato de release;
2. o endpoint de Auth do Supabase responder corretamente;
3. uma requisição anônima ao recurso protegido `households` não enxergar nenhuma Casa;
4. o frontend gerar o artefato de produção usando exatamente aquela configuração de staging.

## O que este smoke não prova

Ele não aplica migrations, não cria usuários, não usa credenciais privilegiadas, não altera dados e não substitui a homologação Wallace + Guilherme. Também não valida backup/restore.

Até existir uma execução verde desse workflow apontando para o projeto de staging real, a pendência de staging em `release-readiness.md` continua aberta.
