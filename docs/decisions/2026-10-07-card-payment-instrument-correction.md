# Decisão — correção do cartão de uma compra já registrada

**Data:** 2026-10-07

## DEFINIDO

Quando uma compra no cartão for registrada no cartão incorreto, o Casa deve permitir uma ação específica **Corrigir cartão** no detalhe do gasto, desde que a compra ainda esteja financeiramente limpa e não liquidada.

A correção:

- mantém a mesma despesa econômica;
- não cria novo gasto;
- não apaga o lançamento original;
- move a compra para a fatura correspondente ao cartão correto;
- preserva valor, data, categoria, comprador e responsabilidade econômica;
- registra a alteração no histórico auditável.

## Guardrails

A ação não deve ser oferecida quando já houver:

- funding/pagamento associado;
- obrigação financeira vinculada;
- pagamento por terceiro;
- parcelamento;
- ocorrência de recorrência;
- outra correção/estorno já registrado.

Nesses casos, o lançamento exige uma rota financeira específica para preservar a coerência do histórico.

## Motivo

Titularidade do cartão, comprador, responsabilidade econômica e funding são dimensões independentes. Corrigir o cartão não pode alterar nenhuma das demais dimensões.

## STATUS

**DEFINIDO + EM IMPLEMENTAÇÃO (PR #428).**
