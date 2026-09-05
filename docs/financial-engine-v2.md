# Casa Finance — Financial Engine v2

## 1. Propósito

Este documento formaliza o contrato financeiro que sustenta o [Product Spec v2](./product-spec-v2.md). O motor separa fato econômico, compromissos, caixa, responsabilidade e funding para explicar um acontecimento sem duplicá-lo.

## 2. Invariantes centrais

1. **Caixa não é sinônimo de receita/despesa.**
2. **Despesa é reconhecida uma única vez.**
3. **Titular, comprador, registrador, responsável e funder são independentes.**
4. **Previsto não é realizado.**
5. **Eventos posteriores preservam vínculo com a origem.**
6. **Financiamento não altera a natureza econômica.**
7. **Data econômica, mês financeiro e data de caixa são independentes.**
8. **Passado financeiro é corrigido, não apagado.**
9. **Toda entrada deve indicar se criou renda, reduziu recebível, criou dívida ou moveu patrimônio.**
10. **O usuário descreve o fato; o motor interpreta.**

## 3. Modelo conceitual

### 3.1 Evento econômico

`transactions` reconhece uma receita, despesa, rendimento, encargo ou perda uma única vez. `transaction_components` decompõe principal, juros, taxa, multa, rendimento ou perda; `transaction_links` relaciona origem, refund, reversão ou financiamento. Meio de pagamento e número de parcelas não mudam a natureza do evento.

### 3.2 Money movement

`money_movements` registra uma entrada ou saída de um recurso, prevista ou realizada. Movimento de caixa não implica receita/despesa: transferência, acerto, recebimento de principal, pagamento de fatura e aporte são exemplos neutros.

O saldo atual deriva de:

```text
account_balance_events canônicos
+ money_movements realizados
```

Forecast nunca altera o saldo real.

### 3.3 Economic allocations

`economic_allocations` distribui responsabilidade econômica entre membros e terceiros. As allocations fecham o valor aplicável em centavos e não são inferidas de comprador, registrador, titular ou funder.

### 3.4 Funding

- **Funding realizado:** atribui a um membro o recurso que efetivamente liquidou um compromisso.
- **Funding projetado:** atribui o recurso/membro que deverá liquidar compromissos futuros conhecidos, sem alterar caixa.

No cartão, titularidade não é funding realizado. A rota prevista pode sustentar funding projetado; o pagamento da fatura materializa funding realizado mantendo o vínculo com as compras.

### 3.5 Acerto

O acerto entre membros é uma conta-corrente contínua, sem reset mensal:

```text
acerto realizado
= funding realizado
- responsabilidade correspondente

acerto projetado
= funding projetado
- responsabilidade dos compromissos futuros correspondentes
```

Os estados não se misturam. Liquidação é explícita; transferência excedente não gera dívida inversa silenciosa.

### 3.6 Mês financeiro e três relógios

- **Data econômica:** ocorrência do fato econômico.
- **Mês financeiro:** período em que o compromisso ou entrada participa do planejamento.
- **Data de caixa:** realização da entrada/saída.

Uma compra de R$ 2.400 em 20/09, parcelada em 12 vezes de R$ 200 com primeira fatura em outubro, reconhece R$ 2.400 economicamente em setembro; compromete R$ 200 em cada mês financeiro desde outubro; e movimenta caixa no pagamento de cada fatura.

## 4. Estados, realização parcial e valor efetivo

Os estados econômicos seguem `forecast`/previsto, `confirmed` e `realized`. A passagem do tempo não promove estado.

Não se cria um estado `partial` somente para realização parcial:

```text
confirmed 1.000
realized_amount 400
=> permanece confirmed enquanto incompleto

realized_amount 1.000
=> realized
```

Um cálculo usa **um único valor efetivo por evento**:

1. `realized`, quando aplicável;
2. senão `confirmed`;
3. senão `estimated`/`forecast`.

As versões nunca são somadas.

## 5. Recursos e perspectivas

### 5.1 Conta conjunta

A Casa usa 100% do saldo de uma conta conjunta. Cada perspectiva individual de liquidez usa 50%, apenas para responder quanto o membro pode movimentar sem depender do outro. Essa convenção não muda responsabilidade econômica, ownership persistido nem funding.

### 5.2 Perspectiva individual

Combina renda, compromissos, liquidez utilizável, responsabilidade, funding e acertos do membro. Não é simples filtro de ativos e deve distinguir “minha responsabilidade”, “pode sair dos meus recursos” e “a receber do outro membro”.

### 5.3 Investimentos e reservas

São classes patrimoniais separadas do caixa transacional. Aporte/resgate de principal é neutro; rendimentos e perdas são eventos econômicos separados. A necessidade de resgate para despesas rotineiras pode agravar saúde, mas não muda a classificação contábil.

### 5.4 Benefícios

São recursos restritos. Carga não é salário; uso gera despesa econômica e reduz o recurso. Não compõem saldo atual transacional.

### 5.5 Dinheiro físico

Tem saldo e localização. Saque e depósito são transferências entre recursos; compra em dinheiro é despesa e saída realizada.

### 5.6 LIS

LIS é crédito, não caixa. Saldo `-350`, limite total `2.000`, utilizado `350` e disponível `1.650` preserva saldo atual `-350`; o disponível nunca aumenta dinheiro ou projeção. LIS usado agrava saúde.

## 6. Obrigações e terceiros

### 6.1 Receivables e payables

`financial_obligations` guarda direito (`receivable`) ou dever (`payable`); `obligation_events` preserva liquidações parciais, quitação, cancelamento ou baixa.

- Recebível de terceiro **não melhora a projeção principal antes de receber**. Recebimento aumenta caixa e reduz recebível, com renda zero.
- Pagável aberto **compromete a projeção**. Pagamento reduz caixa e a obrigação sem duplicar a despesa de origem.
- Posições líquidas podem ser informativas, mas não compensam obrigações brutas implicitamente.

Se terceiro paga despesa da Casa, a intenção é obrigatória: presente mantém despesa, caixa Casa zero e pagável zero; reembolso mantém despesa e cria pagável ao terceiro.

### 6.2 Empréstimos

Empréstimo concedido cria saída de caixa e receivable, não despesa. Empréstimo tomado cria entrada de caixa e payable, não renda. Amortização de principal é neutra; juros, tarifas e perda por baixa são fatos econômicos separados e ligados à obrigação.

### 6.3 Transferências e acertos programados

Transferência patrimonial produz duas pernas atômicas, receita zero e despesa zero. Acerto sem data não melhora a projeção do recebedor. Acerto programado afeta as posições individuais na data/mês correspondente e soma zero na Casa.

## 7. Cartão e financiamento

### 7.1 Regra de acerto no cartão

```text
Compra
→ evento econômico
→ compromisso financeiro
→ responsabilidade
→ acerto projetado

Fatura
→ agrega compromissos

Pagamento
→ realiza caixa/funding
→ não cria nova despesa
→ não cria novo acerto
```

O acerto projetado nasce na compra e é distribuído pelos mesmos meses financeiros das parcelas. A fatura agrega, sem reconhecer novamente. O pagamento realiza a rota de caixa/funding vinculada, sem gerar um segundo acerto.

### 7.2 Exposição de crédito

Limite contratado, calculado, usado e disponível descrevem exposição de crédito; não são caixa nem despesa. Faturas atuais/futuras agregam compromissos canônicos sem multiplicar compra, parcela e pagamento.

### 7.3 PIX no cartão

O principal mantém a natureza do evento financiado. Taxa e juros são fatos econômicos separados, com componentes e vínculos próprios.

### 7.4 Financiamento de fatura

Principal financiado substitui/reagenda obrigação e não é nova despesa. Juros, tarifas e demais encargos são despesas próprias vinculadas ao financiamento.

## 8. Recorrência e pendências anteriores

`recurring_rules` define frequência, natureza fixa/variável, estimativa, início e fim opcional. `recurring_occurrences` materializa instâncias idempotentes; regra e ocorrência não são somadas. Alteração pode afetar somente o mês ou ocorrências futuras.

Uma previsão vencida sem confirmação/realização torna-se **pendência anterior**. Permanece em aberto na projeção, sem mudar a data econômica ou virar realizada automaticamente.

## 9. Refunds e correções

Refund total ou parcial não é renda comum. Mantém vínculo com a compra e sua rota pode ser mesma fatura, fatura futura, conta ou pendente; o motor não infere rota ausente.

Antes de efeitos dependentes, edição pode ser permitida. Depois de parcelas, faturas, funding, acertos ou obrigações, uma correção preserva histórico, registra autoria/razão e recalcula o futuro. Operações compostas são atômicas; o frontend não deve executar múltiplos updates financeiros independentes. Delete financeiro não é fluxo normal.

## 10. Projeção

A projeção é cumulativa por mês financeiro:

```text
projected_end(M)
= projected_start(M)
+ reliable inflows(M)
- commitments(M)
```

`projected_end(M)` alimenta `projected_start(M+1)`. Compromissos incluem faturas, parcelas, pagáveis e pendências anteriores. Recebível de terceiro não melhora a projeção principal antes de recebido. Acerto sem data não melhora o recebedor; acerto programado afeta indivíduos e Casa = 0.

## 11. Atenção, saúde e confiança

**Atenção** contém somente causas acionáveis, consolidadas: vencimento sem confirmação, risco de cobertura da fatura, pagável/recebível/renda/acerto vencido, LIS usado ou projeção negativa. Forecast futuro normal não é alerta.

**Saúde** expressa capacidade financeira em green/yellow/red. Os thresholds percentuais são calibráveis pelo produto, nunca invariantes contábeis; agravantes só pioram a classificação.

**Confiança da projeção** é uma avaliação qualitativa da atualização dos dados e permanece separada da saúde. Não usa percentual artificial.

## 12. Fontes canônicas futuras

Preservar e evoluir, sem recriar equivalentes sem justificativa:

- `transactions`;
- `transaction_components`;
- `transaction_links`;
- `economic_allocations`;
- `money_movements`;
- `funding_events`;
- `account_ownerships`;
- `account_balance_events`;
- `financial_parties`;
- `financial_obligations`;
- `obligation_events`;
- `cards`;
- `card_invoices`;
- `installments`;
- `card_invoice_payments`;
- `financing_allocations`;
- `recurring_rules`;
- `recurring_occurrences`.

Na aplicação autenticada, o Supabase persistido e seus read models canônicos são as fontes da aplicação. Funções puras TypeScript e frontend obedecem ao mesmo contrato, mas não substituem essas fontes.

As migrations **001–021 são imutáveis**. Qualquer evolução começa em **022+**; quantidade e nomes serão definidos somente na implementação.
