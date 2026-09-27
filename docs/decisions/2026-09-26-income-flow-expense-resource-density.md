# Homologação — simplificação de Nova Entrada e recursos de Nova Despesa — 2026-09-26

## DEFINIDO — Nova Entrada

A ordem da jornada é:

1. **De quem é esta entrada?**
2. **Onde entrou?** — recurso compatível com a titularidade da pessoa selecionada. Os cards devem ser compactos e priorizar **nome do recurso**, **instituição** e **titular**; rótulos genéricos de tipo ficam fora quando forem redundantes.
3. **De onde vem?**
4. **Valor**
5. **Quando?**
6. **Categoria**
7. **Essa entrada já está confirmada?**
   - Sim, já sei que vou receber.
   - Ainda é uma expectativa.
8. **Repetir esta entrada**.
9. **Salvar entrada**.

O antigo campo visível **Tipo** deixa de fazer parte da experiência. Categoria é a classificação apresentada ao usuário. A natureza técnica exigida pelo contrato financeiro permanece interna e não deve competir com Categoria na interface.

## DEFINIDO — Nova Despesa / seletor de recurso

O seletor **De onde saiu ou será cobrado?** deve ser compacto e escaneável:

- ícone pequeno, apenas como apoio;
- mais de uma opção visível por linha quando a largura permitir;
- nome do recurso como informação principal;
- instituição e titular em informação secundária discreta;
- não repetir textos óbvios como **Pix / débito**, **Dinheiro** ou **Vale / benefício** quando o próprio recurso já comunica o meio;
- preservar a distinção entre conta, carteira, benefício, cartão e pagamento por terceiro no domínio.

Objetivo: reduzir rolagem e a sensação de formulário longo sem remover informação necessária para identificar corretamente o recurso.

## BUG CORRIGIDO — lista de Entradas

A tela Entradas usava a consulta genérica de transações, que carregava dependências específicas de despesas (obrigações, pagamentos externos e parcelamentos) mesmo quando a tela precisava somente de renda. A leitura de Entradas passa a utilizar um caminho focado em transações de renda e suas dependências relevantes.

A correção é apenas de leitura/apresentação. Não altera fatos econômicos, movimentos de caixa, recorrências ou regras de titularidade.
