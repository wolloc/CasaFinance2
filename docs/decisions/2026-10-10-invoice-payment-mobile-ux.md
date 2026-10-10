# UX — pagamento de fatura no celular

Data: 2026-10-10

## DEFINIDO — simplificação do formulário
- Remover explicações redundantes sobre a conta planejada; manter a conta sugerida identificável e permitir troca.
- Manter fatura, saldo em aberto, conta de origem, valor e data visíveis e legíveis em telas estreitas.
- Campos de entrada devem respeitar a largura do modal e não provocar overflow horizontal.
- Preservar a regra financeira existente: pagar fatura reduz caixa e obrigação do cartão, sem criar uma nova despesa.

## DEFINIDO — falha ambígua
- Em caso de falha de transporte ou resposta incerta, orientar a pessoa a manter os mesmos dados e tentar novamente; a operação deve reutilizar a mesma chave de idempotência.
- Não declarar sucesso sem confirmação nem orientar uma nova operação com dados diferentes.
- Antes de qualquer nova tentativa com identidade diferente, reconciliar o estado do pagamento no backend.

## PENDENTE — aceite
- Validar visualmente no preview em celular.
- Confirmar pagamento integral e parcial, troca da conta de origem e recuperação de resposta ambígua.
- Verificar que saldo da conta e saldo em aberto da fatura permanecem coerentes e que não há duplicidade.
