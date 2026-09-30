# Homologação — fechamento de ações, aporte e faturas

Data: 2026-09-30

## DEFINIDO — ações financeiras
- Após uma ação financeira ser salva com sucesso, o Casa mostra uma confirmação breve e fecha o modal automaticamente, retornando à tela de origem.
- Nova Entrada e Nova Despesa já seguem o padrão de fechar após salvar e continuam assim.

## DEFINIDO — aporte e resgate
- A disponibilidade de aporte/resgate depende da leitura dos recursos atuais.
- Falha apenas no histórico de rendimentos/perdas não pode bloquear aporte ou resgate.
- O histórico é informação auxiliar e pode ficar temporariamente indisponível sem impedir movimentação de principal.

## DEFINIDO — faturas
- Remover explicações técnicas redundantes do modal de fatura.
- Uma fatura materializada com saldo em aberto pode ser paga antes do vencimento; quando futura, o CTA usa “Adiantar pagamento”.
- Pagamento de fatura reduz caixa e obrigação do cartão, sem criar uma nova despesa.
- Lançamentos da fatura priorizam data da compra, descrição, tipo e valor.
- Remover o texto genérico “ainda compõe ... em aberto”; estados excepcionais como cancelamento/estorno podem continuar visíveis.
