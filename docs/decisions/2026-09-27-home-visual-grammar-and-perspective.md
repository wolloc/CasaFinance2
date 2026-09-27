# Home — gramática visual e perspectiva única — 2026-09-27

## Status

**DEFINIDO**

A Home do Casa deve manter a mesma arquitetura de informação ao alternar entre **Nossa Casa** e a perspectiva individual de cada membro.

O seletor de perspectiva é um filtro da mesma Home. Ele não pode transformar a experiência em uma segunda Home com outra ordem, outros nomes ou outra hierarquia.

## Espinha da Home

1. Como estamos?
2. Precisa de atenção
3. Mês em resumo
4. Onde está nosso dinheiro
5. Cartões
6. Próximos 7 dias
7. O que mais pesou
8. Valores com pessoas
9. Olhando pra frente

Quando um bloco ainda não possuir read model individual canônico, a interface não deve copiar dados da Casa e fingir que estão filtrados.

## Perspectiva

- **Nossa Casa**: leitura consolidada.
- **Membro**: mesma linguagem e mesmos blocos quando houver dados individuais canônicos.
- A perspectiva selecionada deve permanecer visível logo abaixo do seletor para reforçar continuidade.

## Recursos

A classificação visual não deve confundir tipo de conta com intenção de uso.

- **Contas e dinheiro**: recursos transacionais/uso corrente.
- **Benefícios**: recursos restritos de benefício.
- **Dinheiro reservado**: recurso marcado explicitamente com `resource_restriction='reserve'`.
- **Investimentos**: recursos patrimoniais/investimento.

Uma conta poupança não é automaticamente uma reserva. Ela só entra como **Dinheiro reservado** quando foi explicitamente marcada com intenção de reserva.

## Simplificação de copy

**DEFINIDO:** regras financeiras importantes permanecem no motor, testes e documentação, mas não precisam ser repetidas como parágrafos permanentes em cada seção da Home.

Exemplos removidos:
- explicação de patrimônio vs dinheiro livre;
- helper permanente sobre parcelamento em categorias;
- helper de projeção futura;
- descrições redundantes de cartões, próximos eventos e valores com pessoas.

## Empréstimos

**PROPOSTO — ainda não implementado nesta decisão**

Usar o mesmo motor/jornada de empréstimos em dois pontos de entrada contextuais:

1. **Conta/recurso → Pegar dinheiro emprestado**
   - abre `LoanAdjustment`;
   - direção `taken` pré-selecionada;
   - conta selecionada pré-preenchida como destino.

2. **Valores com pessoas → Empréstimos**
   - permite escolher `Emprestei dinheiro` ou `Peguei emprestado`;
   - mantém principal separado de renda/despesa;
   - reutiliza os mesmos comandos canônicos de empréstimo.

Não criar um segundo motor ou um segundo modelo de dados.
