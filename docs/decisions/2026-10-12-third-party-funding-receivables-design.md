# Conciliação de funding e recebíveis de terceiros

**Status:** PROPOSTA TÉCNICA EM IMPLEMENTAÇÃO — Issue #460  
**Dependência:** PR #459 (ledger de contribuições)  
**Data:** 2026-10-12

## Objetivo

Criar recebível somente quando houver evidência de que a Casa efetivamente financiou uma parcela/compra com dinheiro de uma conta. Responsabilidade econômica atribuída a terceiro, isoladamente, não é funding.

## Fontes canônicas

- `pay_card_invoice` registra o pagamento da fatura e distribui o valor efetivamente pago.
- `funding_events` identifica o financiamento efetivo por `household_id`, `invoice_id`, `financed_transaction_id` e `installment_id`.
- `financial_member_commitment_responsibility_positions` fornece a parcela econômica atribuída à contraparte, mas não é prova de funding.
- `third_party_contribution_events` (PR #459) registra dinheiro recebido de terceiro, sem classificar como renda e sem, por si só, criar recebível.
- `financial_obligations` e `obligation_events` oferecem histórico e liquidação parcial; o vínculo com o compromisso canônico precisa ser explícito e idempotente.

## Invariantes financeiros

1. Uma parcela futura não gera recebível antes de funding real.
2. O recebível bruto de uma parcela não pode superar a menor destas grandezas: responsabilidade econômica do terceiro naquela parcela; funding acumulado efetivamente comprovado naquela parcela.
3. Contribuições recebidas antes do funding permanecem como caixa recebido e reduzem o recebível inicial a criar quando ocorrer funding. Não são renda.
4. Contribuições recebidas depois de existir recebível devem liquidar esse recebível — não podem também ser subtraídas novamente do cálculo de recebível futuro.
5. Pagamentos parciais e perdões são eventos distintos, auditáveis e idempotentes. Perdão não gera movimento de caixa nem despesa adicional.
6. O ciclo de recebíveis não altera, apaga ou cancela a compra original nem suas parcelas futuras.
7. Reexecução de reconciliação não pode duplicar obrigação, recebimento ou movimento.
8. Todas as gravações correlatas ocorrem em uma transação atômica; validações incluem Casa, compromisso, contraparte, fatura e parcela.

## Modelo técnico em avaliação

**Proposta:** introduzir um vínculo explícito de recebível gerado por funding com a chave canônica da parcela/compra e com a(s) evidência(s) de `funding_events`. Esse vínculo deve garantir unicidade por Casa + compromisso + contraparte e registrar valores de funding elegíveis, contribuição prévia aplicada ao recebível e obrigação criada.

A obrigação pode reutilizar `financial_obligations`/ `obligation_events` somente se for possível associar o recebível gerado ao compromisso canônico sem ambiguidade e sem reaproveitar indevidamente o fluxo de despesas. Não usar obrigação manual sem vínculo como substituto do registro automático.

## Cenários de aceite

### Paloma Ohana — Carrefour
Compra de R$ 3.567,20 em 10 parcelas de R$ 356,72. Cada parcela deve ser conciliada separadamente pela respectiva fatura e `installment_id`. A parcela de outubro/2026, vencimento 28/10/2026, só gera recebível após funding efetivo dessa parcela. As parcelas futuras continuam existindo mesmo que uma dívida anterior seja perdoada.

### Andreia Ferreira — Churrasco do Russo
Responsabilidade de R$ 49,99 com vencimento em 09/11/2026. A projeção não vira recebível até que o funding real da compra/fatura seja comprovado. Se houver contribuição antes do funding, ela reduz o recebível inicial; se a Casa não tiver financiado, não há recebível.

## Segurança e rollout

- Não aplicar migrations nem alterar dados financeiros no Staging nesta etapa.
- Criar testes em Supabase isolado com replay completo das migrations.
- Validar concorrência, idempotência, recebimento pré e pós-funding, funding parcial, pagamento parcial e perdão.
- Aplicar migration remota somente após revisão explícita e CI verde.
