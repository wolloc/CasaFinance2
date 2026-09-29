# Homologação — transferência contextual e resumo de Gastos

Data: 2026-09-29

## DEFINIDO
- Ao iniciar uma transferência a partir de um recurso da Home, “De qual conta saiu?” deve preservar o recurso selecionado como origem.
- A validação de compatibilidade de contas por pagador/recebedor pertence apenas ao fluxo de acerto entre membros e não pode limpar a origem de uma transferência comum.
- O resumo da lista de Gastos não exibe mais as linhas “realizado” e “comprometido”; permanece o total da visão e o acesso às categorias.

## Guardrails
- Transferência continua sendo movimentação neutra entre recursos, sem criar renda ou despesa.
- A remoção do texto do resumo de Gastos é somente de UX; não altera cálculos nem read models.
