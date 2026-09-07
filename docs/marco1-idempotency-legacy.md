# Marco 1 — idempotência dos comandos financeiros legados

A camada `financial_command_requests` protege retries de comandos antigos que ainda não possuem `request_key` no contrato original.

A regra é: uma intenção financeira mantém a mesma chave enquanto o resultado é incerto. O wrapper idempotente usa lock transacional por Casa + operação + chave, retorna o resultado previamente persistido quando a mesma tentativa já foi concluída e só chama o RPC legado quando ainda não existe resultado.

Cobertura desta etapa: pagamento de fatura, recebimento de renda, pagamento direto de gasto, transferência entre contas, acerto entre membros, liquidação e baixa de obrigação de terceiro, principal de empréstimo, performance de investimento, criação+pagamento imediato de gasto direto/compartilhado e liquidação de ocorrência recorrente.

A camada não altera semântica financeira: pagamento continua funding/caixa de fato econômico existente; transferência e acerto permanecem neutros para renda/despesa; principal de empréstimo permanece patrimonial; performance de investimento continua separada do principal; baixa de recebível continua perda sem saída de caixa.
