# Decisão — onboarding financeiro e posição inicial

**Estado: DEFINIDO**

## Data de corte

A data de corte é o início do controle financeiro no Casa Finance. Ela delimita a leitura dos relatórios: valores e compromissos anteriores podem explicar a posição de abertura, mas não significam que o aplicativo conhece toda a vida financeira anterior da pessoa.

A Casa é somente o contexto de organização, colaboração, segurança e consolidação. Ela não é dona de dinheiro, patrimônio, dívida, direito ou obrigação. Recursos têm um ou dois membros ativos como titulares explícitos; terceiro continua sendo representado pelos modelos de terceiros existentes.

## Recursos de abertura

Conta bancária, dinheiro em carteira, carteira digital, benefício, investimento e reserva usam `account_balance_events(kind='opening')`. Esse evento é auditável, tem data efetiva e não cria `transactions`, receita, despesa, `money_movements` ou `funding_events`.

O campo legado `accounts.opening_balance` não é usado para novos cadastros. Investimento e reserva começam como posição patrimonial; somente rendimentos/perdas posteriores seguem o comando normal de performance.

## Cartão de crédito

Cartão não recebe “saldo inicial” como se fosse conta. A abertura registra exposição/compromissos já existentes:

1. **Compra histórica detalhada:** preserva uma única compra econômica na data original, suas allocations e seu plano de parcelas. Somente parcelas que ainda não estavam liquidadas na data de corte permanecem abertas em faturas, compromissos e limite. A baixa anterior é marcada como `opening_settled_amount`, sem criar pagamento, funding ou caixa dentro do período controlado.
2. **Ajuste agregado de abertura:** quando não há histórico suficiente, o sistema cria um `transaction` canônico de tipo `adjustment` ligado à fatura aplicável. Ele representa apenas obrigação/exposição existente: não tem comprador, categoria, allocation econômica, receita ou despesa. O pagamento posterior continua passando exclusivamente por `pay_card_invoice`, que cria a liquidação real naquele momento.

A compra histórica detalhada não é uma nova despesa na data de corte; é o mesmo fato passado mantido para explicar compromissos futuros. O ajuste agregado também não é compra econômica.

## Invariantes

- posição inicial não é entrada, renda ou despesa;
- posição inicial não simula caixa, funding ou pagamento após a data de corte;
- pagamento de fatura continua sendo liquidação, não despesa;
- só o saldo aberto de cartão consome limite;
- pagamentos anteriores à data de corte permanecem conhecidos sem serem recriados como movimentos do período;
- operações de abertura são idempotentes e isoladas por Casa.

## Escopo da etapa seguinte

A segunda PR desta entrega expõe esses comandos no onboarding em linguagem comum: data de início, “quanto existe aqui hoje?” e, para cartão, “já existem compras ou parcelas?”. Não deve reintroduzir escrita direta no campo legado nem expor termos internos do motor.