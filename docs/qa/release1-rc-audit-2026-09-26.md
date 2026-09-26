# Release 1 — Auditoria de Release Candidate — 2026-09-26

**Status:** BLOQUEADO PARA GO-LIVE público, mas apto a entrar em homologação final de RC.

## Candidato auditado

- SHA: `3e13803934478bb18ae0cb749654e95ab2409073`
- Vercel produção: READY
- Supabase Staging: `gfyfudstizsjlvbisrkt` — ACTIVE_HEALTHY
- Supabase principal: `fvksvbjoftuhjxbxufbf` — ACTIVE_HEALTHY

## Gates recuperados diretamente no Staging

Como o GitHub Actions continua encerrando o job antes do primeiro step (`steps=null`), os três contratos SQL principais foram executados diretamente no Staging.

Todos são transacionais, encerram com `ROLLBACK` e não deixam dados sintéticos.

### PASSOU — pr_l_release1_golden_journey.test.sql

Plano de 29 asserts.
Último assert observado: `ok 29 - L27 invoice payment never becomes a second Gastos commitment`.
Sem diagnóstico de falha emitido pelo `finish()`.

### PASSOU — pr_m_release1_everyday_extended.test.sql

Plano de 27 asserts.
Último assert observado: `ok 27 - M27 repayment schedule closes exactly 100`.
Sem diagnóstico de falha emitido pelo `finish()`.

### PASSOU — pr_n_release1_reconciliation.test.sql

Plano de 20 asserts.
Último assert observado: `ok 20 - N20 member settlement remains one neutral internal money movement`.
Sem diagnóstico de falha emitido pelo `finish()`.

### Limpeza confirmada

Após os testes:
- casas sintéticas restantes: 0;
- usuários sintéticos restantes: 0.

## O que já está verde para RC

- fluxo básico de Casa/membros homologado;
- cadastro/edição básica de contas, cartões e categorias homologado;
- Nova Entrada owner-first + recorrência integrada;
- Nova Despesa orientada pelo recurso;
- recorrência de despesa mensal por duração;
- Gastos e Entradas com navegação/período/perspectiva;
- Home mensal canônica;
- recursos acionáveis;
- fatura contextual + pagamento total/parcial delegado ao comando canônico;
- Acertos contextuais + histórico neutro;
- visão futura em Realizado / Comprometido / Planejado;
- calendário nacional implementado;
- testes SQL de reconciliação financeira principais verdes no Staging.

## BLOCKER 1 — promover banco principal com segurança

O Supabase principal está parado em:

`202609060056 partial_direct_refunds`

O Staging está em:

`20260926040840 income_destination_ownership_guard`

Existem 51 migrations registradas no Staging que ainda não existem no principal.

Além disso, antes de aplicar `202609060057_card_invoice_credit_refunds.sql` no principal é obrigatório executar o bridge forward-only do repositório:

`20260906005630_card_journey_credit_columns_bridge.sql`

Motivo: o principal ainda possui a versão de 20 colunas de `financial_card_journey_positions`; o Staging possui a versão de 22 colunas. Aplicar a 057 diretamente pode falhar por mudança ordinal/nome de coluna.

### Gate de promoção

Antes de aplicar ao principal:

1. backup/checkpoint verificável;
2. validar bridge 05630 no schema do principal;
3. aplicar migrations em ordem;
4. rodar contratos SQL Golden Journey/Everyday/Reconciliation;
5. conferir advisors e read models críticos;
6. executar Golden Journey manual;
7. só então promover como Go-live.

**Não aplicar 51 migrations diretamente sem checkpoint.**

## BLOCKER 2 — GitHub Actions indisponível

O workflow CI continua falhando antes do primeiro step:
- TypeScript/tests/build: `steps=null`;
- contratos Supabase: skipped;
- sem Checkout/log útil.

Isso é indisponibilidade do gate, não teste vermelho.

Enquanto persistir:
- Vercel READY cobre build/deploy;
- contratos SQL críticos podem ser executados no Staging;
- lint/unit/integration/e2e locais ainda precisam de um gate confiável antes do Go-live.

## BLOCKER 3 — Golden Journey manual do RC

Ainda precisa ser executado no SHA congelado após a última rodada:
1. posição inicial;
2. Entrada + recebimento;
3. despesa em conta;
4. despesa em cartão;
5. fatura + pagamento parcial/total;
6. acerto parcial;
7. Entradas/Gastos;
8. fechamento/reconciliação visual.

## BLOCKER 4 — decisão de compra no dia do fechamento

Issue #272 continua PENDENTE para compra realizada exatamente no dia do fechamento do cartão.

Não deve ser resolvida por inferência silenciosa. Antes do Go-live:
- decidir regra conservadora da Release 1; ou
- limitar explicitamente o comportamento/escopo e garantir correção posterior sem duplicidade.

## Segurança — checklist antes do Go-live público

### Não-blocker confirmado
`household_invitations` aparece no advisor como RLS sem policy, mas:
- `authenticated` não possui SELECT/INSERT/UPDATE/DELETE direto;
- acesso é feito por RPCs específicos.

### PENDENTE de configuração
Leaked Password Protection do Supabase Auth está desativado.

Para um app financeiro público, habilitar antes do Go-live é recomendado.

### SECURITY DEFINER
O advisor lista muitos RPCs `SECURITY DEFINER` executáveis por `authenticated`.
Isso é parcialmente esperado na arquitetura atual de comandos financeiros, mas deve ser tratado como auditoria direcionada:
- cada RPC público precisa autenticar/autorizar a Casa internamente;
- não corrigir genericamente trocando para invoker sem analisar o contrato;
- manter revogação de `PUBLIC/anon` e grants mínimos.

## Pendências que NÃO são blockers automáticos

- categoria de Entrada vs. tipo de Entrada: decisão de produto ainda em aberto;
- ícone canônico editável de categoria: refinamento;
- refinamentos visuais adicionais da Home: podem seguir após RC se não quebrarem Golden Journey.

## Critério para liberar

A Release 1 só passa para **APROVADO PARA GO-LIVE** quando:
- banco principal estiver alinhado e reconciliado;
- um gate de código confiável estiver verde;
- Golden Journey manual estiver aprovado no RC final;
- regra do dia de fechamento estiver decidida/contida;
- checklist mínimo de segurança estiver concluído.
