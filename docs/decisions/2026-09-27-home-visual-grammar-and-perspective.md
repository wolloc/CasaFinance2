# Home — gramática visual e perspectiva única — 2026-09-27

## Status

**DEPRECADO PARCIALMENTE** — a arquitetura de perspectiva única permanece válida, mas a lista de seções e os agrupamentos de recursos foram substituídos por `2026-09-27-home-question-consolidation.md`.

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

**DEFINIDO e IMPLEMENTADO**

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

A rota antiga de empréstimo a partir de Gastos foi deprecada; o mesmo `LoanAdjustment` é reutilizado nos dois pontos contextuais.


## Refinamento visual — Valores com pessoas e cartões

**DEFINIDO**

- O seletor de perspectiva é autoexplicativo. Não repetir abaixo dele textos como "Perspectiva: Nossa Casa / Wallace / Guilherme".
- **Valores com pessoas** deve mostrar primeiro a relação e o saldo, e só depois os detalhes:
  - membros: uma linha por dupla, com posição atual e tendência;
  - terceiros: uma linha por pessoa, com saldo líquido e próximo vencimento;
  - histórico, compromissos e ações ficam dentro do detalhe expandido.
- Não usar na Home títulos como "A Casa deve para X" ou "X deve para a Casa" como nome principal da relação. O nome da pessoa é a âncora visual; a direção aparece como "A receber" ou "A pagar".
- Cartões e faturas acessados a partir da Casa devem abrir como uma camada contextual com fechamento por X, preservando a Home por trás.
- O motor de faturas e pagamentos não muda; esta decisão é somente de navegação e apresentação.

**PENDENTE**

A seção **Onde está nosso dinheiro** ainda merece uma rodada visual própria para aumentar a densidade útil de cada recurso sem voltar a poluir a Home. Não alterar o modelo financeiro para resolver apenas apresentação.
