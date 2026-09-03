# Homologação, backup e recuperação

## Promoção de ambientes

Cada ambiente usa um projeto Supabase e credenciais próprios. `development` roda localmente; `staging` recebe migrations e o artefato aprovado pela CI; `production` recebe exatamente o mesmo artefato após aceite de Wallace e Guilherme. A aplicação valida `APP_ENV`, `PORT`, `DATABASE_URL` e `SUPABASE_URL` na inicialização. Gemini é opcional: sem a chave, apenas OCR fica indisponível.

## Deploy e migrations

1. Criar backup verificável antes da mudança (`supabase db dump --project-ref "$PROJECT_REF" -f backup.sql`).
2. Restaurar o dump em staging e executar `supabase db reset`, `supabase db lint` e os testes de RLS.
3. Aplicar migrations versionadas com `supabase migration up --linked` antes de promover a aplicação.
4. Executar smoke test em `/api/health` e os dez cenários E2E.
5. Em falha, interromper writers, reverter a aplicação e restaurar o dump em projeto isolado. Migrations financeiras são aditivas; não executar `DROP CASCADE` nem rollback destrutivo em produção.

**Objetivos:** RPO de 24 horas e RTO de 4 horas. Manter backup diário por 30 dias, com cópia semanal por 90 dias. Simular restauração mensalmente, registrar duração, contagens por tabela e reconciliação de saldos/faturas.

## Roteiro funcional obrigatório

- [ ] Criar casa e convidar o segundo membro.
- [ ] Cadastrar conta e cartão.
- [ ] Registrar salário recebido.
- [ ] Transferir entre contas e confirmar resultado inalterado.
- [ ] Registrar compra no cartão em 12 parcelas, sem débito bancário imediato.
- [ ] Registrar conta fixa com responsabilidade 50/50.
- [ ] Pagar fatura e confirmar que a despesa não foi duplicada.
- [ ] Conferir acerto realizado e projetado do casal.
- [ ] Tentar acessar a casa com membro externo e receber bloqueio.
- [ ] Sair, entrar novamente e conferir persistência.

## Gate e relatório de bloqueadores

**Decisão atual: NÃO PUBLICAR.**

| Severidade | Bloqueador | Saída exigida |
|---|---|---|
| Crítico | A API ainda usa armazenamento em memória; reinício perde dados. | Implementar adaptador PostgreSQL/Supabase transacional e executar o fluxo de relogin. |
| Alto | Os dez fluxos não têm automação E2E em navegador. | Adicionar Playwright contra staging e evidências mobile/iPhone. |
| Alto | RLS foi validada estaticamente, não contra Supabase local nesta execução. | Rodar migrations e testes com dois JWTs reais no CI. |
| Médio | Health check informa configuração, mas ainda não consulta PostgreSQL/Gemini. | Adicionar probes com timeout e estados `ready/degraded`. |
| Médio | `npm audit` depende da disponibilidade do registry e deve permanecer como gate da CI. | Corrigir ou aceitar formalmente cada vulnerabilidade. |
| Baixo | OCR é opcional fora de produção e não tem probe ativo. | Exercitar OCR apenas em staging com documento sintético. |

Nenhuma promoção é autorizada enquanto houver item crítico ou alto. O responsável pelo release deve anexar evidências dos comandos, do restore e do roteiro funcional ao change record.
