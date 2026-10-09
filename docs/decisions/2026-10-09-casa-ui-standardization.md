# Padronização visual dos componentes da Casa — 2026-10-09

**Status: PROPOSTO / EM IMPLEMENTAÇÃO**

## Objetivo
Reduzir diferenças visuais entre as seções do menu Casa com estilos compartilhados, preservando conteúdo financeiro, navegação e ações existentes.

## Escopo desta entrega
- Centraliza classes reutilizáveis de superfícies financeiras no componente `FinancialSectionHeading`.
- Padroniza tipografia responsiva de cabeçalhos de página e de seção.
- Reutiliza o padrão de cabeçalho em “Onde está nosso dinheiro?”.
- Harmoniza bordas, fundos, espaçamentos e estados de foco nos cartões de recursos, posição mensal, atenção e valores com terceiros.
- Mantém tons semânticos distintos para alertas e estados financeiros.

## Guardrails
- Não altera cálculos, consultas, regras de negócio ou persistência.
- Não remove campos nem ações existentes.
- Não considerar concluído até CI/build passarem e o preview ser validado em desktop e celular.

## Critérios de aceite
1. Cabeçalhos e superfícies principais usam os mesmos padrões reutilizáveis.
2. Estados de foco por teclado permanecem visíveis.
3. Conteúdo não fica cortado em larguras móveis.
4. Ações de recursos, cartões, atenção e acertos continuam acessíveis.
5. Testes e build aprovados; preview publicado e conferido visualmente.

## Fora de escopo
Redesenho completo, mudança de paleta global ou alteração de regras financeiras.
