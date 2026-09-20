# Decisão — reconciliação de contas existentes na data de corte

**Estado: DEFINIDO**

## Contexto

Uma Casa criada antes da adoção da posição inicial canônica pode já ter contas e cartões cadastrados, enquanto `accounts.opening_balance`, `accounts.owner_member_id` e movimentos anteriores não representam uma abertura auditável do novo período de controle.

Esses dados não podem ser promovidos silenciosamente, porque isso poderia transformar cadastro legado ou histórico de desenvolvimento em dinheiro real.

## Regra

Quando uma Casa ainda não possui `financial_tracking_started_on`, mas já possui contas ativas, a aplicação deve reconciliar essas contas antes de permitir novos cadastros financeiros.

O usuário confirma explicitamente:

- a data de início do controle;
- o saldo de cada conta **no início dessa data**;
- um ou dois titulares ativos de cada conta.

Todas as contas ativas são reconciliadas na mesma operação. O campo legado `opening_balance` e a titularidade legada não são copiados automaticamente.

## Efeito financeiro

A posição confirmada é gravada em `account_balance_events(kind='opening')` e a titularidade em `account_ownerships`.

O read model de saldo passa a considerar somente eventos e movimentos na data de corte ou depois dela. Registros anteriores permanecem preservados para auditoria, mas deixam de compor o saldo controlado.

A reconciliação não cria `transactions`, renda, despesa, `money_movements` ou `funding_events`.

## Cartões

O cadastro do cartão existente é preservado. Depois de confirmar as contas e a data de corte, compromissos que já existiam no cartão são registrados pelos comandos de abertura definidos em `2026-09-20-financial-onboarding-opening-position.md`; pagamento posterior continua sendo liquidação de fatura.

## Segurança operacional

A reconciliação é atômica e idempotente. Um retry da mesma intenção não cria segunda posição inicial. Se houver abertura canônica sem data de corte, o fluxo bloqueia novos cadastros e exige revisão em vez de reinterpretar os dados automaticamente.
