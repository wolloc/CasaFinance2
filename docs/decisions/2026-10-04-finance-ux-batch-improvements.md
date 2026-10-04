# Decisões — melhorias financeiras e UX de 2026-10-04

## Status
- Terceiro na responsabilidade de lançamento: IMPLEMENTADO na branch de evolução; pendente homologação.
- Atualização após ação financeira: IMPLEMENTADO para as ações do menu Gastos; padrão a ampliar conforme outras jornadas.
- Classificação de recursos na Casa: IMPLEMENTADO.
- Valores dos lançamentos em Gastos: IMPLEMENTADO na UI da branch; pendente homologação.
- Busca de Gastos: CORRIGIDA no PR #399 e publicada em deployment separado.

## Responsabilidade com terceiros
O editor de responsabilidade de um lançamento passa a permitir até três participantes, incluindo terceiros cadastrados em `financial_parties`.

A correção altera somente a responsabilidade econômica. Comprador, meio de pagamento, financiador/pagador histórico e efeitos de caixa já ocorridos permanecem preservados.

As alocações de membros continuam alimentando `transaction_splits`; alocações de terceiros permanecem em `economic_allocations.responsible_party_id`.

## Atualização pós-ação
Uma ação financeira só provoca nova leitura quando uma operação foi concluída com sucesso. Não é usado reload completo da página nem polling contínuo.

O fluxo esperado é:
AÇÃO → persistência confirmada → refresh financeiro → telas afetadas relidas.

## Casa — classificação dos recursos
A classificação visual deixa de depender da existência de instituição bancária.

- `checking` / `savings` → Contas.
- `cash` / `digital_wallet` → Dinheiro.
- `meal_benefit` → Benefícios.
- investimentos/reservas seguem em Investimentos e reservas.

## Gastos — hierarquia dos valores
O valor principal representa o valor relevante para a perspectiva atual.

- Perspectiva da Casa: valor da parcela/compromisso.
- Perspectiva de um morador: valor da parte daquele morador.
- `Parcela x/y` aparece como contexto.
- Valor original aparece de forma discreta quando diferente do valor principal.

Nenhuma hipótese de responsabilidade deve ser inferida apenas pela apresentação visual.

## Busca de Gastos
A busca deve ser puramente derivada da lista já carregada e nunca alterar o motor financeiro. Foi corrigida uma referência a helper inexistente que causava tela preta ao digitar uma busca.
