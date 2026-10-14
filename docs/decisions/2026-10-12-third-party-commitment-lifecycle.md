# Ciclo de vida financeiro dos valores com terceiros

**Status da regra de produto:** DEFINIDO em 2026-10-12  
**Status da implementação:** PARCIAL; evolução incremental pendente de validação  
**Escopo:** compras no cartão e demais compromissos com responsabilidade econômica atribuída a uma pessoa externa.

## Objetivo

Permitir que a Casa acompanhe o valor que cabe a cada terceiro, quando se espera receber, quanto foi efetivamente recebido, quanto a Casa financiou, o saldo ainda devido e todo o histórico de acordos — sem duplicar despesas, receitas, movimentos de caixa ou parcelas.

## Conceitos que não podem ser confundidos

1. **Responsabilidade econômica:** parcela da compra atribuída ao terceiro em `economic_allocations`.
2. **Contribuição prevista:** valor esperado do terceiro em uma unidade de compromisso (por exemplo, uma parcela de cartão), projetado pela data financeira canônica do compromisso.
3. **Recebimento realizado:** dinheiro efetivamente recebido, com data e conta de destino registradas.
4. **Valor financiado pela Casa:** parte da responsabilidade do terceiro efetivamente coberta por funding confirmado da Casa.
5. **Recebível financiado:** saldo que o terceiro ainda deve à Casa após o financiamento efetivo, reduzido por recebimentos e baixas válidas.

Uma alocação econômica não prova pagamento nem, sozinha, prova que a Casa financiou o terceiro. Uma projeção nunca pode ser exibida como caixa disponível.

## Regras DEFINIDAS

- A compra econômica original é registrada uma única vez.
- Compra no cartão gera compromisso financeiro por fatura/parcela; não gera saída de conta na compra.
- A data financeira da contribuição prevista acompanha o vencimento canônico da fatura/parcela, e não simplesmente a data da compra.
- Compra parcelada de R$ 3.567,20 em 10 vezes não deve ser apresentada como R$ 3.567,20 de compromisso em um único mês. Cada parcela deve ser acompanhada no mês e vencimento correspondentes.
- Antes do vencimento, a contribuição do terceiro pode ser projetada, sem ser tratada como recebida nem como saldo disponível.
- Se o terceiro pagar antes ou na data, registrar o recebimento real, sua data e conta de destino; reduzir a contribuição prevista/pendente pelo valor recebido. A mesma quantia não pode continuar simultaneamente como entrada projetada.
- Se o terceiro pagar parcialmente, baixar apenas o valor recebido e manter o saldo pendente.
- Se a Casa pagar a fatura e cobrir parte da responsabilidade do terceiro, reconhecer como recebível financiado apenas o valor efetivamente coberto e ainda não recebido. Não criar nova despesa.
- Se o terceiro já tiver contribuído antes do pagamento da fatura, essa contribuição deve reduzir o valor que ainda precisa ser coberto/financiado; não pode virar um segundo recebimento nem um recebível integral duplicado.
- Se as partes renegociarem a data, atualizar a projeção futura do saldo em aberto, mantendo o histórico da data e do acordo anteriores. Não criar outra obrigação para o mesmo saldo.
- Perdão de dívida reduz/encerra o recebível por um evento explícito e auditável, sem entrada de caixa. O perdão de uma parcela já financiada não cancela parcelas futuras da compra que ainda vencerão.
- A conta de destino do recebimento e a conta que efetivamente pagou a fatura são fatos diferentes e devem refletir os movimentos reais.
- O painel deve distinguir compromisso do mês de saldo total em aberto, e permitir rastrear pessoa, compra original, parcela/fatura, recebimentos, funding, renegociações e baixas.
- Operações de escrita devem ser idempotentes e isoladas por `household_id`.

## Transições de estado esperadas

| Situação | Estado financeiro | Efeito na projeção |
|---|---|---|
| Responsabilidade alocada, compromisso ainda não financiado | Contribuição prevista | Entrada esperada no vencimento da parcela |
| Terceiro transfere antes da fatura ser paga | Contribuição recebida/antecipada | Remover o valor recebido da entrada esperada; guardar conta/data |
| Fatura é paga pela Casa | Funding confirmado | Converter apenas a parte ainda não coberta por contribuição em recebível financiado |
| Terceiro paga depois do funding | Recebível parcialmente/totalmente liquidado | Registrar entrada real e reduzir saldo do recebível |
| Pagamento parcial | Saldo remanescente | Projetar apenas o restante |
| Data renegociada | Acordo atualizado | Mover projeção do saldo; preservar evento anterior |
| Perdão de dívida | Baixa/perdão | Remover projeção do valor perdoado, sem movimento de caixa |

## Guardrails de implementação

- Não inferir o financiador a partir do comprador, titular do cartão ou responsável econômico.
- Não gerar obrigações automaticamente para dados históricos sem origem comprovada ou ação explícita de reconciliação.
- Não converter um item projetado em recebível financiado sem evidência canônica de funding da fatura/compromisso.
- Não usar uma única obrigação com vencimento da compra para representar várias parcelas com vencimentos distintos.
- Não usar `commitment_funding_plans` como cronograma de recebimento do terceiro; essa tabela representa rota de funding da Casa.
- Não tratar uma previsão de entrada como `money_movement` realizado.
- Manter a compra, as parcelas e a fatura como fatos canônicos; o relacionamento com o terceiro é uma camada de acompanhamento/liquidação relacionada a esses fatos, não uma segunda despesa.
- A trilha de auditoria deve preservar eventos anteriores; edição de data/valor não deve apagar a história.

## Casos de regressão obrigatórios

1. **Andréia — R$ 50,00 em uma compra no cartão:** projeção no vencimento correto; recebimento integral antecipado; recebimento no vencimento; nenhum recebimento e funding da fatura pela Casa; recebimento parcial; renegociação; perdão.
2. **Paloma — compra de R$ 3.567,20 em 10 parcelas:** compromissos separados por vencimento; não mostrar o total da compra como compromisso integral de outubro; funding confirmado por parcela; saldo acumulado de recebível; pagamentos parciais em meses posteriores; perdão de saldo antigo sem cancelar parcelas futuras.
3. Recebimento antes do funding e depois do funding não podem produzir saldo/entrada duplicados.
4. Repetição da mesma requisição não pode duplicar eventos ou movimentos.
5. Atribuição sem terceiro ou sem data financeira comprovável não pode ser completada por inferência.
6. Isolamento entre casas, arredondamento em centavos e compatibilidade com a perspectiva individual e a visão consolidada.

## Plano de entrega

1. Auditar e estender as posições canônicas por compromisso/parcela e os eventos de funding/recebimento.
2. Implementar o estado intermediário de contribuição prevista/recebida sem criar movimento fictício.
3. Fazer a transição atômica para recebível financiado quando houver funding confirmado, deduzindo contribuições já recebidas.
4. Implementar recebimento parcial, renegociação e perdão com histórico.
5. Conectar o painel Casa e suas ações aos comandos canônicos.
6. Executar testes SQL de regressão, testes de integração/TypeScript/build e smoke funcional em Staging.
7. Só então aplicar a migration ao Supabase de destino e publicar via fluxo normal de PR/CI.

Este documento registra as regras de produto. Não afirma que todas as transições já estão implementadas.
