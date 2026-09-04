# Motor Financeiro v1 — Etapa 10C

## 1. Decisão central

O ledger canônico separa três fatos que podem ocorrer em datas diferentes:

1. `transactions` reconhece o **evento econômico** uma única vez (despesa, receita ou custo/perda relacionado);
2. `money_movements` registra **caixa** previsto ou realizado, sem inferir natureza econômica;
3. `financial_obligations` registra **direitos e deveres** (receivable/payable), liquidados por um histórico imutável em `obligation_events`.

Cartão, PIX no cartão, conta, vale-alimentação, dinheiro físico e empréstimo são mecanismos de financiamento. Eles não mudam a natureza do evento econômico. Pagamento de fatura, transferência, aporte, resgate, desembolso/recebimento de principal e recarga de benefício não são receita ou despesa.

## 2. Auditoria e gaps (A–O)

### A. Gaps encontrados

- `create_financial_transaction` cria compras em conta como `pending`, mas não cria saída de caixa/funding nem liquidação direta.
- `transaction_splits` aceita somente `household_members`; não representa Letícia ou outra contraparte sem login.
- Não há conceito geral de contraparte, contas a receber/pagar nem histórico de liquidações parciais, cancelamento ou perda.
- `accounts.owner_member_id` só expressa um titular; `null` é ambíguo e não expressa conta conjunta.
- `opening_balance`/`opened_at` não formam evento auditável.
- `transactions.status` e `money_movements.state` não preservam, juntos, estimativa, confirmação, realização parcial e atraso.
- `transaction_payment_instruments` é singular e não representa componentes de principal/juros/taxa/multa nem múltiplos mecanismos.
- Faturas têm pagamentos parciais, mas não uma obrigação explícita para saldo rotativo/parcelado, encargos ou antecipação.
- `loans` + `loan_installments` e `loan_contracts` + `loan_payment_schedule` duplicam empréstimos tomados e misturam contrato, caixa e despesa.
- O saldo atual e a posição patrimonial dependem de consultas ad hoc; não há read model canônico.

### B. Estruturas reaproveitadas

- `transactions` continua sendo a fonte de eventos econômicos e preserva comprador, registrador, categoria, recorrência, estorno e parcelamento.
- `money_movements` continua sendo a fonte de movimentos projetados/realizados por conta.
- `funding_events` continua atribuindo funding real de despesas aos membros, inclusive por fatura/parcela.
- `cards`, `card_invoices`, `card_invoice_payments`, `installment_plans` e `installments` permanecem canônicos para cartão.
- `transfers` permanece o vínculo de uma circulação interna de duas pernas.
- `recurring_rules` e `recurring_occurrences` mantêm idempotência; ocorrências passam a preservar valor estimado e podem ser confirmadas.
- `accounts`, `household_members`, categorias e RLS por Casa são mantidos.

### C. Novas estruturas

- `financial_parties`: terceiros locais à Casa, sem perfil/auth e sem vínculo com dados fake.
- `economic_allocations`: responsabilidade econômica por membro **ou** terceiro; substitui `transaction_splits` para novos fluxos.
- `account_ownerships`: titularidade explícita, inclusive conjunta, sem qualquer inferência de responsabilidade/funding.
- `account_balance_events`: posição inicial e ajustes rastreáveis, separados do cadastro.
- `transaction_links`: origem tipada para refund, devolução, juros, taxa, multa, perda e financiamento.
- `transaction_components`: composição de principal, juros, taxa, multa, perda e rendimento.
- `financial_obligations` e `obligation_events`: receivables/payables e seu histórico de liquidação.
- `financing_allocations`: principal/encargos alocados a conta, cartão, fatura ou parcela; suporta PIX no cartão sem torná-lo categoria.
- colunas aditivas de valor e estado em `transactions`, `recurring_rules`, `recurring_occurrences`, `card_invoices`, `installments`, `accounts` e `money_movements`.

### D. Estruturas legadas/depreciadas

- `transaction_splits` permanece compatível e somente leitura nos fluxos compostos; `economic_allocations` é a fonte futura.
- `accounts.owner_member_id`, `opening_balance` e `opened_at` não são removidos, mas não são fontes canônicas futuras.
- `loans`/`loan_installments` e `loan_contracts`/`loan_payment_schedule` permanecem intactos. Novos empréstimos tomados e concedidos usam `financial_obligations`; adaptadores/migração de dados ficam adiados.
- `settlements` continua disponível para acerto entre membros, mas obrigações novas com terceiros usam o modelo geral.

### E. Novos RPCs

- `create_financial_party`: cadastra terceiro isolado pela Casa.
- `set_account_ownerships`: substitui atomicamente a lista explícita de titulares.
- `record_account_opening_position`: cria uma única posição inicial auditável.
- `create_financial_obligation`: cria direito/dever sem movimento implícito.
- `settle_financial_obligation`: registra recebimento/pagamento parcial ou total, caixa e funding sem criar segunda receita/despesa.
- `write_off_receivable`: baixa saldo a receber e cria uma única despesa econômica de perda relacionada.
- `confirm_financial_transaction`: preserva estimativa e define valor confirmado.
- `settle_direct_expense`: liquida despesa em conta, cria saída e funding real de forma atômica.

### F. RPCs existentes

- `create_financial_transaction` é substituída com a mesma assinatura: passa a preencher os valores estimado/confirmado e copiar splits para `economic_allocations` (inclusive `party_id`). Como a assinatura antiga não recebe financiador explícito, a liquidação em conta permanece uma segunda chamada atômica a `settle_direct_expense`; comprador ou titular nunca são inferidos como financiador.
- `generate_recurring_occurrence` mantém a assinatura e idempotência, mas grava ocorrência prevista e preserva estimativa.
- `pay_card_invoice` continua aceitando qualquer conta/funder real e não usa `cards.default_payment_account_id`; esta coluna é apenas previsão.
- `create_transfer` permanece uma circulação interna realizada, sem efeito econômico.

### G. Estados e valores

Estado econômico (`economic_state`) é independente da liquidação: `forecast`, `confirmed`, `realized`, `cancelled`, `reversed`. `estimated_amount`, `confirmed_amount` e `realized_amount` preservam as três medidas. Obrigações têm `open`, `partially_settled`, `settled`, `cancelled`, `written_off`; atraso é derivado de `due_date < current_date` com saldo aberto. Caixa conserva `projected`/`realized`.

### H. Terceiros

Terceiros vivem em `financial_parties`, são sempre pertencentes a uma Casa, não possuem `profile_id`, não fazem login e podem atuar como devedor, credor, beneficiário, pagador ou destinatário. Papéis são dados na relação (`economic_allocations`, obrigação ou movimento), nunca inferidos da contraparte.

### I. Receivables/payables

Uma obrigação guarda valor original e contraparte. Seu saldo é `original_amount - eventos que reduzem saldo`; recebimentos/pagamentos parciais mantêm histórico. Principal recebido/pago só cria movimento de caixa. Baixa de receivable cria evento `write_off` e transação de perda separada, relacionada à origem.

Na compra compartilhada, `economic_allocations` registra R$ 300 dos membros e R$ 150 do terceiro; uma obrigação receivable de R$ 150 aponta para a mesma transação. A saída de R$ 450 não duplica a despesa da Casa.

### J. PIX/cartão/encargos

`financing_allocations.mechanism = 'card_pix'` descreve o mecanismo. `transaction_components` e `financing_allocations.component_kind` separam principal, juros, taxa e multa. Encargos são transações econômicas próprias ligadas por `transaction_links`; o principal pode financiar uma despesa ou originar receivable. Parcelas/fatura continuam nas tabelas existentes.

### K. Conta conjunta

Uma conta ativa deve ter uma ou duas linhas em `account_ownerships`, configuradas atomicamente. Duas linhas significam conta conjunta. Titularidade não preenche comprador, responsável ou funder.

### L. Saldo inicial

`account_balance_events(kind = 'opening')` é o novo evento inicial, único por conta e rastreável por autor/data. Os campos antigos não são copiados automaticamente para evitar transformar ou associar dados legados. A aplicação deverá optar explicitamente pelo RPC novo.

### M. Read model

- `financial_account_balances`: posição inicial/ajustes mais entradas menos saídas realizadas.
- `financial_obligation_balances`: saldo, valor liquidado e atraso por obrigação.
- `financial_invoice_positions`: total, pago, saldo, atraso e conta prevista.
- `financial_member_positions`: responsabilidade econômica e funding real por membro.
- `financial_household_position`: dinheiro livre/restrito, reservas, investimentos, receivables, payables, obrigações futuras, comprometido, projetado, faturas e patrimônio líquido básico.

As views usam `security_invoker` e as tabelas-base usam RLS, evitando bypass de isolamento.

### N. Migrations

1. `202609040018_financial_engine_v1_model.sql`: enums, tabelas, colunas, índices e documentação de depreciação.
2. `202609040019_financial_engine_v1_security.sql`: validação cross-household, invariantes, RLS, grants e triggers.
3. `202609040020_financial_engine_v1_rpcs.sql`: operações atômicas e ajustes compatíveis nos RPCs existentes.
4. `202609040021_financial_engine_v1_read_models.sql`: views canônicas e permissões de leitura.

### O. Riscos e compatibilidade

- Clientes antigos continuam lendo colunas/tabelas antigas, mas não verão automaticamente allocations externas.
- Não há backfill automático de `opening_balance`, splits ou empréstimos antigos: fazê-lo sem confirmação poderia reinterpretar dados reais ou fake.
- Enums PostgreSQL recebem valores de forma aditiva; consumidores exaustivos devem tolerar novos valores.
- O read model é contábil básico, não marca investimentos a mercado e não calcula tributos/câmbio.
- Rotativo de cartão é representável como payable + componentes, mas cálculo automático de juros e renegociação foi deliberadamente adiado.
- Antecipação altera datas/estado das parcelas, porém descontos e regras de emissor não são calculados automaticamente.

## 3. Fontes canônicas futuras

| Conceito | Fonte |
| --- | --- |
| Evento econômico | `transactions` + `transaction_components` + `transaction_links` |
| Responsabilidade | `economic_allocations` |
| Caixa | `money_movements` realizado + `account_balance_events` |
| Funding real de membro | `funding_events` |
| Titularidade | `account_ownerships` |
| Terceiro | `financial_parties` |
| Direitos/deveres | `financial_obligations` + `obligation_events` |
| Cartão | `cards`, `card_invoices`, `installments`, `card_invoice_payments` |
| Previsão | valores/estado econômico + movimentos `projected` + recorrências |
| Empréstimo novo | obrigação + movimentos + componentes de principal/juros |

`DatabaseStore` e seu conteúdo fake não participam dessas fontes e não recebem associação automática.
