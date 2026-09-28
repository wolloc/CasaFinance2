# Homologação mobile — entradas, gastos, ajustes e Home

Data: 2026-09-27

## DEFINIDO

### Ajustes
- Áreas secundárias de Ajustes abrem em modal/sheet sobre a tela de Ajustes.
- O modal fecha pelo X ou ao tocar fora.
- O conteúdo funcional existente é preservado; a mudança é de navegação/apresentação.

### Ações globais
- Gasto e Entrada continuam concentrados no controle flutuante global.
- O arraste deve respeitar o viewport visual real do navegador móvel e não pode vazar pelas laterais.

### Entradas
- Hierarquia do card: data, descrição, categoria, beneficiário, estado/valor.
- Entrada com data de hoje ou anterior representa valor já recebido e movimenta o recurso escolhido.
- Entrada com data futura é previsão e não movimenta saldo.
- O formulário não pergunta ao usuário se a entrada é confirmada ou prevista; a data define isso.
- Em recorrência, a primeira ocorrência com data de hoje/passada é recebida; as futuras permanecem previstas.
- Valor recebido usa destaque verde; valor previsto usa destaque âmbar/laranja.
- A palavra “Titular” não é exibida nos cards de seleção de recurso.

### Gastos
- Hierarquia do card: data da compra, descrição, categoria, responsabilidade, recurso, valor.
- Comprador não é informação prioritária da lista.
- Gasto econômico já ocorrido usa valor em vermelho, inclusive compras no cartão.
- Projeção futura usa âmbar/laranja.
- Pagamento de fatura não cria novo gasto econômico.

### Home
- Recursos em mobile usam duas colunas; telas maiores podem ampliar a grade.
- “Próximos 7 dias” deixa de competir como seção independente na visão principal e passa a compor “Precisa de atenção”.
- A área de atenção deve permanecer reservada a itens úteis para ação/revisão.

## Guardrails financeiros preservados
- Transferência entre recursos não é renda nem despesa.
- Entrada futura não altera saldo.
- Compra no cartão é gasto econômico realizado; o pagamento da fatura é efeito de caixa.
- Recorrência futura é projeção até a ocorrência ser realizada.
