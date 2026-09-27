# Home — consolidação das perguntas e recursos — 2026-09-27

## Status

**DEFINIDO**

Esta decisão substitui os trechos anteriores que tratavam **Mês em resumo**, **O que mais pesou** e **Dinheiro reservado** como seções independentes da Home.

## Como estamos?

- **Como estamos?** e **Mês em resumo** passam a ser um único bloco.
- O bloco mantém o visual destacado de **Como estamos?**.
- O conteúdo adota a leitura compacta aprovada de **Mês em resumo**: Entrou, Ainda entra, Já comprometido/Já saiu e Ainda compromete/Ainda pode sair.
- Mantém também o saldo atual e a projeção de fechamento.
- Não existe mais uma seção separada chamada **Mês em resumo**.

## Precisa de atenção

- permanece na Home;
- é expansível e fechada por padrão;
- quando fechada mostra apenas título e indicador;
- ao abrir mostra os itens acionáveis;
- estado sem urgência continua compacto.

## Onde está nosso dinheiro

Agrupamentos de UX:

1. **Contas** — recursos com instituição vinculada;
2. **Dinheiro** — carteira, dinheiro físico, cofre ou recurso equivalente sem instituição;
3. **Benefícios** — VA, VR e demais recursos de benefício;
4. **Investimentos** — investimentos e recursos com intenção de reserva.

**Dinheiro reservado** deixa de existir como grupo visual. A marca de reserva continua canônica e pode aparecer como atributo do recurso dentro de Investimentos.

Os recursos devem ficar visíveis sem exigir abrir primeiro o grupo. Cada linha/card prioriza nome, instituição, titularidade e valor, com ações no detalhe contextual.

## Cartões

Permanece com a fotografia financeira rica: fatura, futuro, limite livre e crédito comprometido. O detalhe continua contextual.

## Categorias

**O que mais pesou** é removido da Home. Categorias permanecem em **Gastos** e **Entradas**.

## Valores com pessoas

- remover o CTA genérico **Adicionar valor** da Home;
- manter **Empréstimos** como entrada contextual;
- deixar claro visualmente quem deve a quem;
- liquidações continuam dentro do detalhe e não criam renda/despesa.

## Próximos acontecimentos e Olhando pra frente

**DEFINIDO para esta rodada:** permanecem na Home enquanto são homologados. A utilidade de ambos ainda será reavaliada antes de qualquer expansão funcional.

## Perspectiva

Nossa Casa e cada membro devem usar a mesma arquitetura de perguntas. Quando não houver read model individual canônico, a Home não deve copiar dado consolidado como se fosse individual.


## Refinamento visual de homologação — 2026-09-27

**DEFINIDO**

- **Onde está nosso dinheiro** deve ser mais visual: o título do grupo e seu total ficam fora de um container pesado; cada recurso é um card próprio.
- Dentro de cada grupo, os recursos aparecem do **maior saldo para o menor saldo**.
- Cada card prioriza nome do recurso, instituição, titularidade e valor; detalhes e ações continuam contextuais ao toque.
- **Valores com pessoas** aparece antes de **Próximos 7 dias**, por estar conceitualmente mais próximo da leitura de recursos e posições financeiras.
- A relação entre os dois membros da Casa recebe maior destaque visual que relações com terceiros.
- Terceiros exibem a responsabilidade econômica quando ela puder ser comprovada a partir do fato de origem: membro único, 50/50 ou divisão customizada. Na ausência de vínculo suficiente, mostrar **Casa** sem inferir 50/50.
- Ao tocar em um cartão da Home, abrir diretamente **Faturas** daquele cartão, preservando seletor temporal e a ação contextual **Pagar tudo ou parte** quando houver saldo em aberto.
- No seletor de recurso da Nova Despesa, **Outra pessoa pagou** permanece como opção em três colunas, com copy reduzida para preservar legibilidade.


## Densidade visual adicional — 2026-09-27

**DEFINIDO:** após homologação em iPhone, os cards de **Onde está nosso dinheiro** passam de duas para **três colunas**. O conteúdo continua compacto e truncável, porque a leitura essencial permanece nome, contexto de instituição/titularidade e valor. Ícones passam a diferenciar semanticamente conta, poupança/reserva, benefício, carteira/dinheiro e investimento, com cor discreta por natureza.

**DEFINIDO:** **Como estamos?** abandona o grande fundo azul como identidade dominante. O bloco fica neutro e deixa cor para os indicadores internos, reduzindo peso visual e melhorando coerência com o restante da Home.
