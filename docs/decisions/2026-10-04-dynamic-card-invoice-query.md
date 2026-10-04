# Decisão — consulta dinâmica da fatura contextual — 2026-10-04

## Status
**IMPLEMENTADO** — consulta contextual da fatura ajustada e pendente de homologação no deploy.

## Problema
Ao abrir a fatura a tela podia cair no erro genérico de conferência, mesmo com a posição financeira disponível.

## Decisão
A abertura contextual passa a consultar a fatura selecionada diretamente pelo `invoice_id` e `household_id`, em vez de carregar todas as faturas da casa para depois filtrar no frontend.

Fluxo:
1. consultar a jornada financeira atual do cartão;
2. selecionar a fatura atual/desejada;
3. consultar dinamicamente somente essa fatura;
4. consultar os lançamentos dessa fatura;
5. usar os valores retornados pelo banco naquele momento.

Não há valor presumido, cache manual ou valor fixo para determinar a fatura.

## Regra financeira
A consulta é somente leitura. Abrir/conferir uma fatura não registra pagamento, não altera limite, não movimenta caixa e não considera a fatura quitada.

## Impacto
Além de reduzir a superfície de falha, a consulta passa a ser específica para o cartão/fatura que o usuário abriu.
