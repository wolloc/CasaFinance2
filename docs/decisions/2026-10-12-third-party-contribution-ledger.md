# Contribuições de terceiros vinculadas a compromissos

**Status:** IMPLEMENTAÇÃO EM REVISÃO — PR #459  
**Data:** 2026-10-12

## Decisão de produto já definida
Uma contribuição recebida de terceiro é dinheiro real entrando em uma conta da Casa, mas não deve ser classificada automaticamente como renda. Também não prova que a Casa financiou a fatura do cartão e não cria, por si só, um recebível da Casa.

## Recorte implementado nesta PR
- Tipo próprio de movimento: `third_party_contribution`.
- Registro auditável ligado à Casa, compromisso canônico, contraparte, conta de destino, data, valor e chave idempotente.
- Validação para impedir recebimentos acumulados acima da responsabilidade econômica atribuída ao terceiro.
- Projeção reduz a contribuição esperada pelo valor já recebido.
- Repetições da mesma chave com o mesmo payload retornam o evento existente; payload divergente é rejeitado.

## Limites explícitos
- Esta PR ainda não cria recebível quando a Casa paga uma fatura.
- Esta PR ainda não implementa baixa do recebível, renegociação ou perdão.
- A projeção atual continua sendo apenas projeção; não deve ser apresentada como saldo disponível.
- A UI para registrar uma contribuição está integrada ao bloco Valores com terceiros, com validações e retorno de erro amigável.
- A conciliação com o funding real da fatura permanece pendente; não interpretar `funded_responsibility_amount` como prova suficiente de funding efetivo.
- Não aplicar a migration no Staging até revisão e CI aprovados.

## Próxima etapa
Conciliar, de forma atômica e idempotente, contribuições recebidas com o funding efetivo por fatura/parcela. O recebível deve representar apenas o valor efetivamente financiado pela Casa, líquido de contribuições, recebimentos posteriores e perdões.
