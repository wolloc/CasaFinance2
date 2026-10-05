# Decisão — reconciliação de duplicidades na fatura do cartão

**Data:** 2026-10-05  
**Estado:** DEFINIDO

## Caso
Na fatura Itaú Uniclass Infinite final 2505, com vencimento em 09/10/2026, o documento oficial informa total de **R$ 2.984,48**.

No Casa havia três cópias de cada um destes lançamentos em uma fatura anterior:
- Apple bill — R$ 28,90
- Sacolão — R$ 27,68
- compra Frederico/Joey — R$ 107,00

Total indevido na fatura anterior: **R$ 490,74**.

## Correção aplicada
- Duas cópias de cada lançamento foram canceladas com histórico de correção.
- Uma cópia de cada lançamento foi transferida para a fatura atual.
- Fatura anterior: **R$ 1.818,01 → R$ 1.327,27**.
- Fatura atual: **R$ 2.820,90 → R$ 2.984,48**.
- A correção foi executada atomicamente e os vínculos projetados de responsabilidade foram cancelados antes da baixa dos duplicados.

## Regra de produto
Uma compra que consta na fatura oficial deve existir **uma única vez** no Casa e estar vinculada à fatura correta. Duplicidades não devem ser resolvidas por estorno/devolução: devem ser tratadas como correção/cancelamento do lançamento indevido.

## Implicação futura
A jornada de fatura deve oferecer uma forma explícita de identificar e corrigir duplicidades, preservando histórico e recalculando a fatura afetada sem criar nova despesa.
