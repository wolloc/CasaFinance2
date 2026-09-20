# Decisão — entrada posterior de recursos na Casa

**Data:** 2026-09-20  
**Estado:** DEFINIDO

## Regra

- A Casa possui uma única `financial_tracking_started_on`, imutável depois de configurada.
- Um membro que entra depois não refaz o corte financeiro da Casa e não confirma saldos de recursos que já pertencem aos demais membros.
- Uma conta, carteira, benefício, reserva ou investimento cadastrado depois do início da Casa recebe sua própria posição inicial na data em que passa a ser acompanhado.
- Essa data não pode ser anterior ao início financeiro da Casa nem futura.
- A posição inicial do novo recurso é um `account_balance_events(kind='opening')`: não cria renda, despesa, funding ou movimento de caixa.
- A titularidade do recurso continua explícita por `account_ownerships`; entrar na Casa não torna o novo membro titular dos recursos existentes.

## Exemplo

Casa inicia em 20/09. Um novo membro entra em 05/10 e passa a acompanhar uma conta com R$ 3.000. A Casa continua iniciada em 20/09; a conta nasce no controle em 05/10 com posição inicial de R$ 3.000, sem registrar renda.
