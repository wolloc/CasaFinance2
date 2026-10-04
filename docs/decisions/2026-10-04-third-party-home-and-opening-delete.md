# Decisão — Terceiros na Casa e exclusão da posição inicial

**Data:** 2026-10-04  
**Status:** DEFINIDO

## Terceiros na Casa

Quando uma despesa possui responsabilidade econômica atribuída a um terceiro, a Casa deve dar visibilidade a esse vínculo no bloco de outras pessoas.

A apresentação usa o conceito **Responsabilidades de terceiros** e mostra:
- nome do terceiro;
- valor total atribuído;
- quantidade de lançamentos envolvidos.

O valor é apresentado como **responsabilidade atribuída**, e não automaticamente como saldo a receber ou dinheiro disponível. Isso evita confundir responsabilidade econômica com funding, reembolso ou acerto.

## Exclusão da posição inicial do cartão

O lançamento histórico de cartão possui `invoice_id` nulo na origem porque suas parcelas apontam individualmente para as faturas. A identificação correta da compra histórica usa:
- lançamento;
- instrumento de pagamento do tipo cartão;
- plano de parcelas.

A exclusão não deve exigir `transactions.invoice_id`.

A ação de UX é **Excluir lançamento histórico**, dentro do detalhe do gasto, e remove logicamente o lançamento e cancela suas parcelas históricas, recalculando as faturas afetadas.

## Homologação

Validar:
1. 100% de terceiro salva;
2. terceiro aparece em Casa com o valor;
3. excluir lançamento histórico funciona;
4. faturas afetadas diminuem somente pelo valor das parcelas daquele lançamento;
5. o lançamento deixa de aparecer no histórico;
6. outros lançamentos da mesma fatura permanecem intactos.
