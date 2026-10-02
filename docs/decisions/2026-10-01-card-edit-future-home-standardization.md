# Edição de cartão e Home futura padronizada

Data: 2026-10-01

## DEFINIDO — edição de cartão

Em **Ajustes → Contas e cartões**, um cartão existente pode ter alterados:
- nome;
- instituição;
- últimos 4 dígitos;
- limite;
- dia de fechamento;
- dia de vencimento.

A alteração vale para o comportamento do cartão daqui para frente.

Compras, faturas e pagamentos já registrados não são reescritos retroativamente.

Titularidade continua separada de comprador, responsabilidade econômica e pagador.

## DEFINIDO — Home em mês futuro

Ao navegar para um mês futuro, a Home deve preservar a mesma gramática visual da Home atual.

O bloco principal continua sendo **Como estamos?**, usando a mesma estrutura de previsão explicável.

A linguagem muda para futuro quando necessário:
- saldo projetado na abertura;
- entradas previstas;
- saídas previstas;
- fechamento projetado.

O Casa não inventa em qual conta, benefício ou investimento o saldo futuro estará. Quando não houver projeção por recurso, a interface deve dizer explicitamente que o patrimônio por recurso não é projetado.

## IMPLEMENTADO — candidato de homologação

- editor de cartões com limite, fechamento e vencimento;
- Home futura usando `MonthlyPositionStatement`;
- remoção do antigo card visual roxo exclusivo de mês futuro;
- seção futura subsequente padronizada como **Olhando pra frente**;
- testes de regressão para impedir retorno ao layout antigo e edição incompleta de cartão.
