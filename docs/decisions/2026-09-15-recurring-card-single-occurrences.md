# Recorrência de despesas no cartão à vista

**Status: DEFINIDO**

Cada ocorrência futura de uma despesa recorrente no cartão é projetada na fatura correspondente como compromisso esperado. A projeção não reduz o limite real antes da cobrança. Quando a cobrança ocorre, a própria ocorrência projetada torna-se uma nova compra realizada, passa a integrar efetivamente a fatura e consome o limite do cartão naquele momento. O consumo do limite acontece ocorrência a ocorrência, e não pelo valor total projetado da série.

Recorrência no cartão e parcelamento são conceitos distintos. Na recorrência, cada período gera uma nova compra independente. No parcelamento, existe uma única compra econômica cujo valor total foi contratado no cartão e distribuído em parcelas.

## Ciclo financeiro

1. A regra materializa ocorrências futuras identificáveis com instrumento `card`, estado econômico `forecast` e compromisso previsto na data/fatura calculada para aquela cobrança.
2. Essa previsão aparece em compromissos e na projeção da fatura, mas não cria `card_invoices`, `funding_events`, `money_movements` ou pagamento de fatura, nem entra na exposição/limite real.
3. Ao confirmar a cobrança, o comando canônico converte a própria transação da ocorrência em uma compra econômica `realized`, ajusta suas allocations em centavos, cria ou reutiliza exatamente uma fatura do ciclo e acrescenta o valor a ela. Não cria uma segunda despesa e ainda não movimenta caixa.
4. `pay_card_invoice` permanece a única rota de liquidação: registra uma saída de caixa, funding e baixa parcial ou total da fatura. Esse pagamento não reconhece nova despesa.

## Limites deste recorte

Somente compra simples à vista no cartão entra nesta decisão. Permanecem fora de escopo: recorrência parcelada, Pix por cartão, terceiros como pagador ou responsável, VA/VR, outro cartão como pagamento de fatura e mudanças de regras de fechamento de emissores. VA/VR continua proibido para recorrência.
