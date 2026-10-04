# Decisão — Exclusão da posição inicial do cartão e responsabilidade de terceiros

**Data:** 2026-10-04  
**Status:** DEFINIDO

## Responsabilidade com terceiro

A responsabilidade econômica de uma despesa pode ser atribuída a moradores e/ou terceiros, em até três participantes, totalizando 100%.

A tabela transaction_splits representa apenas a parcela atribuída a moradores. A fonte canônica da responsabilidade econômica é economic_allocations, que também suporta responsible_party_id.

A validação de integridade deve considerar economic_allocations como total da responsabilidade. Não é válido exigir que transaction_splits totalize 100% quando 100% da responsabilidade pertence a terceiros.

## Exclusão da posição inicial do cartão

Para compras históricas parceladas registradas pela posição inicial do cartão, existe uma ação específica de **Excluir da posição inicial**.

A ação:
- exige que o lançamento tenha sido criado como posição inicial histórica;
- exige cartão e plano de parcelas;
- não permite exclusão se já houver funding realizado;
- cancela as parcelas históricas;
- reduz os valores das faturas afetadas;
- reduz a parcela de opening_settled_amount correspondente ao lançamento;
- cancela acertos projetados derivados do compromisso;
- remove o lançamento da experiência do histórico por exclusão lógica (deleted_at), preservando a rastreabilidade técnica.

A fatura não é editada manualmente pelo usuário. A origem é removida e as faturas afetadas são recalculadas.

## Regra financeira

Excluir uma compra histórica não deve alterar pagamentos/funding reais de outras compras da mesma fatura.

Quando opening_settled_amount de uma parcela histórica estiver inconsistente ou agregado, a contribuição removida da fatura fica limitada ao valor da própria parcela, evitando retirar valores pertencentes a outros lançamentos históricos.

## Pendente

Compras históricas avulsas (sem plano de parcelas) exigem uma rota específica porque o modelo atual não registra, de forma individual, quanto daquele lançamento contribuiu para opening_settled_amount da fatura.
