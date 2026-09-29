# Ações financeiras contextuais por recurso

Data: 2026-09-29

## DEFINIDO
As ações disponíveis na Home dependem do tipo de recurso selecionado.

- Dinheiro / carteira: Depositar em conta, Emprestar dinheiro, Pegar emprestado.
- Conta corrente: Transferir, Sacar, Aportar em investimento, Emprestar dinheiro, Pegar emprestado.
- Poupança: Transferir, Sacar, Aportar em investimento, Emprestar dinheiro, Pegar emprestado.
- Investimento / reserva: Aportar, Resgatar.
- Benefício restrito: não expõe movimentações genéricas incompatíveis; mantém apenas edição/configuração.

## DEFINIDO — contexto e preenchimento
- A ação parte do recurso tocado e leva esse recurso já selecionado para a jornada seguinte.
- Depósito parte de dinheiro/carteira e oferece contas compatíveis como destino.
- Saque parte de conta/poupança e oferece dinheiro/carteira como destino.
- Transferência mantém a origem fixa e oferece outros recursos transacionais.
- Aporte pode partir de conta/poupança ou de um investimento já selecionado.
- Resgate parte do investimento/reserva selecionado e oferece recursos transacionais como destino.
- Empréstimo distingue explicitamente Emprestei dinheiro e Peguei emprestado, mantendo o recurso contextual como origem ou destino.
- Seletores de recurso usam cards visuais sempre que a jornada parte de um recurso da Home.

## Guardrails financeiros
- Depósito, saque e transferência são movimentações neutras entre recursos; não criam renda nem despesa.
- Aporte e resgate de principal são patrimoniais e neutros.
- Pegar dinheiro emprestado cria caixa + obrigação, não renda.
- Emprestar dinheiro reduz caixa + cria recebível, não despesa.
- Benefícios restritos não são tratados como caixa fungível.
