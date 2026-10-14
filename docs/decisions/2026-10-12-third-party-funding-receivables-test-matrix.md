# Testes de aceitação — recebíveis de terceiros

Este arquivo transforma os critérios da Issue #460 em cenários verificáveis. Os testes devem rodar em Supabase isolado, nunca contra os dados financeiros reais de Staging.

## Matriz de cenários

| Cenário | Estado antes | Ação | Resultado esperado |
|---|---|---|---|
| Parcela futura | Sem funding | Consultar conciliação | Nenhum recebível |
| Funding parcial | Parcela de R$ 356,72; Casa financiou R$ 120,00; responsabilidade de Paloma cobre o valor | Conciliar | Recebível limitado à responsabilidade elegível dentro dos R$ 120,00 financiados |
| Contribuição prévia | R$ 40,00 recebidos antes do funding | Funding elegível de R$ 120,00 e conciliação | Caixa de R$ 40,00 permanece registrado; recebível inicial reduzido pelo valor aplicado uma única vez |
| Contribuição pós-funding | Recebível de R$ 80,00 aberto | Registrar recebimento de R$ 30,00 | Recebível restante de R$ 50,00; movimento de caixa de R$ 30,00; sem nova despesa/renda |
| Repetição idempotente | Mesmo evento de funding já conciliado | Executar conciliação novamente | Nenhum recebível ou movimento duplicado |
| Pagamento parcial | Recebível de R$ 80,00 | Liquidar R$ 25,00 | Saldo de R$ 55,00 e evento de liquidação de R$ 25,00 |
| Perdão parcial | Recebível de R$ 80,00, R$ 25,00 já recebidos | Perdoar R$ 20,00 | Saldo de R$ 35,00; evento de perdão sem entrada/saída de caixa; sem duplicar despesa |
| Paloma — outubro/2026 | Parcela R$ 356,72, vencimento 28/10/2026 | Não pagar fatura | Sem recebível para outubro |
| Andreia | Responsabilidade R$ 49,99, vencimento 09/11/2026 | Não pagar fatura | Sem recebível até funding real |

## Invariantes que precisam ser testados

- A chave de vínculo identifica a Casa, compromisso canônico, contraparte e parcela/fatura.
- A soma de recebíveis ativos nunca ultrapassa a responsabilidade econômica elegível nem o funding real atribuível à Casa.
- Contribuição anterior ao funding não pode ser aplicada duas vezes; contribuição posterior baixa o recebível existente.
- A mesma chave de idempotência com payload diferente é rejeitada.
- Operações concorrentes para a mesma parcela são serializadas ou protegidas por unicidade transacional.
- Pagamento/recebimento de recebível não cria segunda despesa para a compra original.
- Perdão de recebível não é tratado como caixa nem como renda; o reconhecimento econômico deve ser explícito e auditável.
- Perdão de uma parcela passada não altera parcelas futuras do plano de compra.
