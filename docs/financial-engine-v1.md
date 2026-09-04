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
- `create_and_settle_shared_expense`: registra o valor bruto, funding e saída uma única vez e cria um receivable por allocation de terceiro.
- `settle_income`: registra o recebimento efetivo e somente então atualiza `realized_amount` da receita.

### F. RPCs existentes

- `create_financial_transaction` é substituída com a mesma assinatura: passa a preencher os valores estimado/confirmado e copiar splits para `economic_allocations` (inclusive `party_id`). Como a assinatura antiga não recebe financiador explícito, a liquidação em conta permanece uma segunda chamada atômica a `settle_direct_expense`; comprador ou titular nunca são inferidos como financiador.
- `generate_recurring_occurrence` mantém a assinatura e idempotência, mas grava ocorrência prevista e preserva estimativa.
- `pay_card_invoice` continua aceitando qualquer conta/funder real e não usa `cards.default_payment_account_id`; esta coluna é apenas previsão.
- `create_transfer` permanece uma circulação interna realizada, sem efeito econômico.

### G. Estados e valores

Estado econômico (`economic_state`) é independente do movimento de caixa: `forecast` é estimativa, `confirmed` é valor conhecido ainda não ocorrido/recebido e `realized` é reconhecimento econômico ocorrido. `realized_amount` é medida **econômica**, nunca saldo de caixa; caixa realizado deriva exclusivamente de `money_movements.state = 'realized'`. Uma compra efetivamente feita pode ser economicamente realizada mesmo no cartão, antes de sair dinheiro da conta. Uma receita criada ainda não recebida nasce `confirmed`, com `realized_amount = 0`, e somente `settle_income` a realiza. Obrigações têm `open`, `partially_settled`, `settled`, `cancelled`, `written_off`; atraso é derivado de `due_date < current_date` com saldo aberto.

### H. Terceiros

Terceiros vivem em `financial_parties`, são sempre pertencentes a uma Casa, não possuem `profile_id`, não fazem login e podem atuar como devedor, credor, beneficiário, pagador ou destinatário. Papéis são dados na relação (`economic_allocations`, obrigação ou movimento), nunca inferidos da contraparte.

### I. Receivables/payables

Uma obrigação guarda valor original e contraparte. Seu saldo é `original_amount - eventos que reduzem saldo`; recebimentos/pagamentos parciais mantêm histórico. Principal recebido/pago só cria movimento de caixa. Baixa de receivable cria evento `write_off` e transação de perda separada, relacionada à origem.

Na compra compartilhada, `create_and_settle_shared_expense` mantém R$ 450 como valor bruto do evento e saída/funding, registra R$ 300 em allocations dos membros e R$ 150 na allocation de Letícia, e cria um receivable de R$ 150 ligado por `source_transaction_id`. Cada terceiro recebe uma obrigação separada. A despesa econômica da Casa é a soma das allocations de membros, não o bruto: R$ 300.

`financial_transaction_positions` torna a distinção explícita com `gross_event_amount`, `gross_cash_paid`, `household_economic_amount`, `third_party_economic_amount` e `third_party_receivable_outstanding`. Assim, o jantar aparece como R$ 450 pagos, R$ 300 consumidos pela Casa e R$ 150 a receber, sem dupla contabilização.

### J. PIX/cartão/encargos

`financing_allocations.mechanism = 'card_pix'` descreve o mecanismo. `transaction_components` e `financing_allocations.component_kind` separam principal, juros, taxa e multa. Encargos são transações econômicas próprias ligadas por `transaction_links`; o principal pode financiar uma despesa ou originar receivable. Parcelas/fatura continuam nas tabelas existentes.

### K. Conta conjunta

Uma conta ativa deve ter uma ou duas linhas em `account_ownerships`, configuradas atomicamente. Duas linhas significam conta conjunta. Titularidade não preenche comprador, responsável ou funder.

### L. Saldo inicial

`account_balance_events(kind = 'opening')` é o novo evento inicial, único por conta e rastreável por autor/data. Os campos antigos não são copiados automaticamente para evitar transformar ou associar dados legados. A aplicação deverá optar explicitamente pelo RPC novo.

### L.1 Recorrência e rateio

Uma ocorrência copia comprador, instrumento previsto e todas as `economic_allocations`, inclusive allocations mistas de membros/terceiros. Ao confirmar valor diferente, `rescale_economic_allocations` preserva percentuais e usa largest remainder determinístico: trabalha em centavos, aplica piso e distribui os centavos restantes pela maior fração e ordem original do rateio. Portanto R$ 287,43 em 50/50 atribui R$ 143,72 ao primeiro split (Wallace no exemplo) e R$ 143,71 ao segundo, fechando exatamente 100% sem impedir a confirmação.

### L.2 Perda

`write_off_receivable` exige `p_splits`; cada split identifica explicitamente `member_id` ou `party_id`, percentual e valor. A perda continua vinculada à obrigação e origem, recebe `transaction_components(kind='loss')` e allocations fechando valor e 100%. Nenhum responsável é inferido de comprador, titular ou financiador.

### M. Read model

- `financial_account_balances`: posição inicial/ajustes mais entradas menos saídas realizadas.
- `financial_obligation_balances`: saldo, valor liquidado e atraso por obrigação.
- `financial_invoice_positions`: total, pago, saldo, atraso e conta prevista.
- `financial_transaction_positions`: bruto, caixa pago, consumo econômico da Casa, parcela externa e receivable externo remanescente.
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
