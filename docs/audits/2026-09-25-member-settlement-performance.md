# Auditoria independente — reconciliação de acertos da PR #287

Data: 2026-09-25  
Escopo auditado: commit `59db380` (`fix: destravar Nova Despesa e recorrência no Staging`).

## Veredito técnico

- **Correção #287 robusta: PARCIAL.** A equivalência semântica da parte alterada foi confirmada por inspeção do SQL anterior e posterior: as mesmas posições canônicas de responsabilidade e funding, os mesmos filtros de Casa/transação/estado e o mesmo cálculo `funding - responsibility` continuam alimentando o ledger. A mudança elimina as subconsultas correlacionadas por compromisso e membro, materializando e agregando cada read model uma vez.
- **Nova Despesa simples:** a evidência de homologação já registrada na PR (cerca de 0,24 s) deixa margem confortável para o timeout de 8 s. A auditoria não encontrou um novo rescan correlacionado dentro do trecho otimizado.
- **Risco remanescente:** a expansão de recorrência continua síncrona, serial e limitada por operação, chamando `generate_recurring_occurrence` para cada regra/data. Cada inserção e cada atualização de `economic_allocations` dispara reconciliação por linha. Assim, o custo continua aproximadamente linear no número de ocorrências multiplicado pelo número de allocations e regras. Os 3,22 s observados para 58 ocorrências não demonstram margem para várias recorrências semanais expandidas juntas; por extrapolação conservadora, três séries equivalentes podem exceder 8 s. Isto é **BUG / DÉBITO TÉCNICO IMPORTANTE**, não evidência de uma nova explosão não linear.
- **Outros caminhos com o mesmo padrão de trabalho repetido:** criação/correção de responsabilidade com mais de uma allocation e geração de recorrência; alterações de ownership/conta/cartão percorrem todas as transações relacionadas e reconciliam uma a uma. Não há evidência suficiente para uma migration corretiva preventiva nesta auditoria.

## Cadeia canônica e pontos de reconciliação

### Nova Despesa direta

1. `explicitExpenseCreation.ts` chama `create_and_settle_direct_expense_idempotent` com chave estável de retry.
2. O wrapper adquire advisory lock, consulta `financial_command_requests`, chama `create_and_settle_direct_expense` e persiste o resultado idempotente.
3. `create_and_settle_direct_expense` cria a transação canônica via `create_financial_transaction` e depois chama `settle_direct_expense` atomicamente.
4. A criação grava `transactions`, instrumento, `economic_allocations`/splits e, conforme o instrumento, compromissos/parcelas.
5. A liquidação grava `funding_events` e `money_movements`; os respectivos guards validam os vínculos e a Casa.
6. Triggers em `economic_allocations`, `installments` e `funding_events` chamam `reconcile_member_settlements`. Para uma despesa direta com duas allocations e um funding, o limite superior observado estaticamente é três chamadas durante a criação/liquidação, sem contar updates explícitos posteriores.
7. A reconciliação cancela apenas conclusões projetadas substituíveis, preserva eventos realizados e recompõe projeções a partir dos read models canônicos.

### Recorrência

1. `ensure_household_recurring_expense_horizon` valida membro ativo, percorre regras ativas e datas até o horizonte e chama `generate_recurring_occurrence` quando a chave regra/data ainda não existe.
2. A ocorrência cria uma transação `forecast`, copia instrumento, allocations e splits e reescala valores; não cria funding nem movimento de caixa.
3. O `INSERT ... SELECT` de allocations e o reescale subsequente acionam o trigger de reconciliação por linha. Com duas allocations, são até quatro reconciliações por ocorrência (duas no insert e duas no update), embora chamadas iniciais possam produzir conclusão transitória que é cancelada e refeita pela chamada seguinte.
4. Cartão recorrente calcula vencimento/fatura, mas permanece uma ocorrência única; confirmação posterior materializa a cobrança sem transformar parcela ou pagamento em novo fato econômico.

### Triggers adicionais auditados

- Mudanças relevantes de valor/data/estado em `transactions` reconciliam a origem; cancelamento somente cancela projeções.
- Inserção/alteração de parcela foi previamente adiada até o plano estar completo, reduzindo N reconciliações para uma na criação parcelada; a RPC idempotente de cartão fecha explicitamente a reconciliação depois da montagem.
- Mudança de plano de funding reconcilia a transação correspondente.
- Mudanças de ownership, conta ou default do cartão percorrem as transações relacionadas. Esse trabalho é proporcional ao histórico afetado e merece medição antes de qualquer alteração.

## Equivalência semântica da #287

A comparação do corpo definido em `202609050026_financial_member_perspectives.sql` com `20260925123000_optimize_member_settlement_reconciliation.sql` confirmou:

- a fonte de compromissos permanece `financial_member_commitment_responsibility_positions`, restrita à mesma Casa e transação;
- funding permanece `financial_member_funding_positions`, restrito à mesma Casa, transação, membro atribuído e estado `projected`;
- somas continuam agrupadas por `commitment_key` e membro antes de calcular saldo;
- membros considerados continuam sendo somente membros ativos da mesma Casa;
- devedor, credor e valor continuam escolhidos pelo menor/maior saldo, com desempate determinístico por UUID e arredondamento a centavos;
- estados `cancelled`/`reversed` continuam cancelando projeções e retornando sem reconstruí-las;
- funding realizado continua append-only por `source_funding_event_id`; retries não duplicam o evento por causa do teste de existência e índice/conflito canônico;
- a migration mantém `SECURITY DEFINER`, `search_path=public,pg_temp` e revoga execução de `public`, `anon` e `authenticated`;
- o parâmetro identifica primeiro a transação e toda mutação subsequente usa `tx.household_id`; a função não aceita `household_id` controlado pelo chamador.

Não foi encontrada alteração na interpretação de conta conjunta, divisão 50/50/customizada, terceiro responsável/pagador, pagamentos parciais, cartão/parcelas, recorrências, correções ou estornos. Esses comportamentos permanecem derivados das mesmas views; a #287 mudou o plano lógico da consulta, não suas fontes.

## Matriz de evidências

| Operação/cenário | Volume coberto | Resultado esperado e protegido | Evidência disponível |
|---|---:|---|---|
| Despesa direta 50/50 | R$ 100, 2 membros | um fato realizado; R$ 50 de Gui para Wallace; um funding; um caixa | pgTAP da PR #287 sob `authenticated` e timeout 8 s; ~0,24 s informado no Staging |
| Retry da Nova Despesa | mesma chave | retorna o mesmo fato, sem novo caixa/funding | wrapper com advisory lock + `financial_command_requests`; testes de idempotência existentes |
| Recorrência semanal em conta | 58 ocorrências/1 ano | forecasts, zero funding/caixa, R$ 50 projetados por ocorrência, replay cria zero | pgTAP da PR #287 sob timeout 8 s; ~3,22 s informado no Staging |
| Responsabilidade customizada | até 2 membros, centavos | allocations fecham 100%; funding não redefine responsabilidade | suítes de criação/correção e perspectivas existentes |
| Um membro paga pelo outro | direto e cartão | saldo é funding menos responsabilidade | suítes `member_settlements` e `financial_member_perspectives` |
| Conta compartilhada | dois owners | funding realizado/projetado dividido 50/50 sem mudar responsabilidade | suíte de perspectivas e acertos |
| Terceiro responsável/pagador | presente, reembolso parcial/integral | funding externo não inventa caixa; pagável limita-se à parcela da Casa | suíte `pr_a_mixed_external_responsibility` |
| Cartão à vista/parcelado | 1 e 12 parcelas | um gasto econômico; compromissos por parcela; projeção sem duplicidade | suítes de cartão, perspectivas e acertos |
| Fatura parcial/integral | parcial e total | parcial não realiza o compromisso inteiro; total não duplica acerto/despesa | `member_settlements` e gates de cartão |
| Recorrência em cartão | ocorrência única | forecast não consome limite; confirmação vira cobrança canônica | `pr_i_recurring_card_single` |
| Renda recorrente | horizonte/replay | projeção não é renda realizada e não chama reconciliação de despesa | suítes de renda recorrente |
| Obrigação e acerto entre membros | parcial, integral, excesso rejeitado | liquidação neutra; sem nova despesa/renda | suítes de obrigações e `member_settlements` |
| Correções/estornos | cancelled/reversed e correção de papéis | histórico preservado; projeções canceladas/recalculadas; funding/caixa histórico intacto | suítes de mutation guards, refund e role correction |

## Limites da execução independente

O ambiente desta auditoria não contém Docker, `psql`, Supabase CLI nem credenciais de Staging. Portanto, não foi possível executar localmente `EXPLAIN (ANALYZE, BUFFERS)`, repetir os tempos do Staging ou produzir uma curva empírica com centenas de fatos. Os números de 0,24 s e 3,22 s acima são evidência reportada pela PR/incidente, não uma medição independente deste ambiente. A suite TypeScript e os contratos estáticos foram executados independentemente.

A ausência dessa medição impede classificar a #287 como totalmente robusta. O próximo gate de banco deve executar, em transação com rollback e `statement_timeout='8s'`, pelo menos 1/3/5 regras semanais por 24 meses, 100/500 despesas históricas, múltiplos cartões/parcelamentos e funding/acertos acumulados, registrando `EXPLAIN (ANALYZE, BUFFERS, WAL, SETTINGS)` da reconciliação. Nenhum dado de carga deve persistir.

## Riscos e governança

### BLOQUEADOR GO-LIVE

- Nenhum bloqueador comprovado para a Nova Despesa simples após #287.
- **PENDENTE:** executar o stress independente acima antes de afirmar margem para expansão de várias séries no mesmo request. Se a UX de go-live chama horizonte para todas as regras da Casa, o risco de timeout composto deve ser aceito ou corrigido com evidência.

### IMPORTANTE

- **BUG / DÉBITO TÉCNICO:** reconciliação por linha durante cópia e reescala de allocations em recorrências. É trabalho redundante comprovado pela topologia dos triggers; o impacto temporal agregado ainda precisa de medição controlada.
- **BUG / DÉBITO TÉCNICO:** `ensure_household_recurring_expense_horizon` tem custo síncrono proporcional a regras × ocorrências × allocations. Não é explosão quadrática demonstrada, mas a margem de uma única série não cobre automaticamente várias séries.

### DÉBITO TÉCNICO

- **IMPLEMENTADO:** triggers de ownership/conta/cartão reconciliam cada transação afetada; correto semanticamente, potencialmente caro em históricos grandes.
- **IMPLEMENTADO:** a migration usa `SECURITY DEFINER` com search path seguro e sem grant público; nenhuma mutação cross-household foi encontrada.
- **PROPOSTO (não implementado):** somente depois de medir, avaliar batching de reconciliação por transação no fim da geração de ocorrência. Não remover triggers, não elevar timeout e não tornar assíncrono sem decisão arquitetural.

## Alterações desta auditoria

Somente este relatório foi adicionado. Nenhuma migration, RPC, trigger, view, regra de produto ou código de aplicação foi alterado. Staging/Supabase não requer `supabase db push` por esta auditoria.
