# Próximo recorte — terceiro como responsável econômico

**Status:** PROPOSTO para implementação imediata, sem alteração de regra financeira.

A Nova Despesa já suporta terceiro como pagador. O próximo recorte conecta **Outra pessoa envolvida** em `Quem assume esse gasto?`, reutilizando `economic_allocations.responsible_party_id` / `partyId`, que já fazem parte do motor atual.

## Objetivo

Permitir que responsabilidade econômica e funding continuem independentes também na UX:

- um membro pode fazer o gasto;
- um terceiro pode assumir parte ou todo o gasto;
- o meio de pagamento continua sendo tratado separadamente;
- um terceiro responsável não é automaticamente o terceiro pagador;
- nenhuma obrigação nasce apenas porque o terceiro é responsável pelo gasto.

## Por que este recorte vem antes do parcelamento de devolução

O motor atual já aceita alocação econômica para terceiros. Portanto esta evolução é principalmente de orquestração/UX e pode reutilizar estruturas existentes.

Já o parcelamento da devolução de uma obrigação exige representar vários vencimentos futuros ligados à mesma obrigação. A estrutura atual de `financial_obligations` possui um único `due_date`; `commitment_funding_plans` resolve a origem planejada do recurso, mas não representa sozinho um cronograma de várias parcelas. Esse tema deve ser tratado em PR estrutural própria para evitar modelagem paralela ou perda de coerência financeira.
