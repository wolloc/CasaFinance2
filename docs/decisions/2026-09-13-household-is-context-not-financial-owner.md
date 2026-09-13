# Decisão — Casa é contexto, não agente financeiro

**Data:** 2026-09-13  
**Status:** DEFINIDO

## Decisão

A **Casa (`household`) é o espaço compartilhado de organização, colaboração, isolamento e consolidação financeira dos usuários**. Ela **não é uma pessoa econômica nem proprietária de dinheiro, patrimônio, contas, dívidas ou direitos**.

No estado atual do produto, uma Casa pode ter **1 ou 2 usuários/membros ativos**.

`household_id` continua sendo usado como chave de escopo, segurança/RLS, colaboração e agregação. Sua presença em uma tabela **não significa titularidade financeira da Casa**.

## Titularidade dos recursos

Todo recurso financeiro deve ser atribuível a um usuário/membro ou a um terceiro identificado.

Exemplos de recursos dos usuários:

- conta corrente;
- carteira/dinheiro físico;
- poupança;
- investimento/reserva;
- VA/VR/benefício;
- outros ativos ou saldos cadastrados.

Esses recursos podem ser exibidos de forma consolidada na perspectiva **Nossa Casa**, mas a consolidação não cria um terceiro proprietário chamado Casa.

Exemplo:

- Wallace possui R$ 10.000 em seus recursos;
- Guilherme possui R$ 8.000 em seus recursos;
- a visão consolidada pode mostrar R$ 18.000;
- não existe um recurso adicional de R$ 18.000 pertencente à Casa.

## Movimentações patrimoniais

Aporte, resgate, aplicação, saque, depósito e transferência movimentam valores entre recursos identificados. Eles não criam automaticamente receita ou despesa.

Toda origem e destino de dinheiro deve ser rastreável até:

1. um recurso de um membro;
2. um terceiro identificado; ou
3. outro fato financeiro explicitamente modelado.

A Casa nunca deve ser usada como origem, destino, proprietário ou funder residual quando o sistema não sabe quem forneceu ou recebeu o recurso.

## Despesas e responsabilidade

Responsabilidade econômica pertence a pessoas — membros ou terceiros — e não à Casa como entidade autônoma.

Pode existir uma **visão consolidada da responsabilidade dos membros da Casa**, que é a soma das parcelas atribuídas aos membros ativos. Essa soma é uma leitura/agregação, não uma nova responsabilidade da Casa.

Exemplo:

Despesa de R$ 100:

- Wallace responsável por R$ 60;
- Robson responsável por R$ 40;
- Robson paga R$ 100.

Resultado correto:

- fato econômico bruto: R$ 100;
- responsabilidade econômica de Wallace: R$ 60;
- responsabilidade econômica de Robson: R$ 40;
- funding externo bruto de Robson: R$ 100;
- se houver devolução, Wallace pode ter obrigação de R$ 60 perante Robson;
- a parcela de R$ 40 de responsabilidade do próprio Robson não vira obrigação dos membros.

Se Wallace e Guilherme forem responsáveis por R$ 30 cada, a visão consolidada pode mostrar **R$ 60 a devolver**, mas a atribuição R$ 30 + R$ 30 deve permanecer rastreável.

## Terceiros

Valores fornecidos por terceiros devem manter natureza explícita, por exemplo:

- doação/presente;
- empréstimo;
- pagamento em nome de um membro;
- reembolso;
- quitação de obrigação;
- outra natureza documentada.

Um terceiro pode financiar uma despesa sem que exista conta ou saída de caixa de um membro naquele momento. Isso não autoriza criar “caixa da Casa”.

## Contas e recursos compartilhados

O produto não deve usar “Casa” como titular financeiro de conta ou recurso.

Se existir uma experiência de recurso compartilhado, sua modelagem precisa preservar quais membros possuem ou participam daquele recurso. Uma regra de apresentação, como divisão 50/50 em determinada perspectiva de liquidez, não transforma a Casa em proprietária do ativo e não define automaticamente responsabilidade econômica ou funding.

## Linguagem de domínio

Evitar em regras e código novo expressões que tratem a Casa como agente econômico, tais como:

- “dinheiro da Casa” como titularidade;
- “a Casa pagou” sem identificar o recurso/funder;
- “dívida da Casa” sem preservar os membros responsáveis;
- “responsabilidade da Casa” como se fosse uma allocation própria;
- “funding da Casa” como origem autônoma.

São aceitáveis como **atalho de apresentação consolidada**, desde que tecnicamente signifiquem explicitamente:

- “recursos dos membros da Casa”;
- “responsabilidade econômica dos membros da Casa”;
- “compromissos consolidados dos membros”.

## Consequências técnicas

Toda implementação financeira deve preservar a distinção entre:

- `household_id` = escopo/isolamento/agregação;
- membro/terceiro = sujeito econômico;
- conta/recurso = local do saldo;
- responsabilidade = pessoa que suporta o fato;
- funding = pessoa/recurso que fornece o dinheiro;
- obrigação/recebível = direito/dever atribuível a pessoas e contraparte;
- perspectiva Nossa Casa = consolidação derivada.

Nenhum fallback técnico pode atribuir dinheiro, funding, responsabilidade, dívida ou direito à Casa por falta de informação.

## Impacto imediato na PR A

Antes do merge da estabilização de responsabilidade mista/pagamento externo, revisar se:

1. os valores consolidados chamados de “Casa share” são apenas a soma das allocations dos membros;
2. a responsabilidade individual dos membros permanece recuperável;
3. pagamentos externos não inventam conta/caixa da Casa;
4. pagáveis e cronogramas não perdem a atribuição aos membros responsáveis;
5. uma obrigação consolidada não impede explicar quanto cabe a cada membro;
6. linguagem de comentários, testes e documentação não cristaliza a Casa como sujeito econômico.

Se o modelo atual não conseguir preservar a atribuição por membro de um direito/dever que precisa ser individual, isso é bloqueante e deve ser tratado antes do merge, sem criar estrutura paralela.