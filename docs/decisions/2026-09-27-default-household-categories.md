# Categorias padrão sugeridas — 2026-09-27

## Status

**DEFINIDO**

Toda nova Casa recebe um conjunto inicial enxuto de categorias de **Gastos** e **Entradas**.

Essas categorias são sugestões iniciais do Casa Finance:
- podem ser renomeadas;
- podem ter ícone e cor alterados;
- podem ser retiradas de uso;
- não são obrigatórias no lançamento;
- não determinam comprador, pagador, funding, responsabilidade econômica, fluxo de caixa ou natureza financeira.

Categoria continua sendo **classificação**. A semântica financeira permanece no motor canônico.

## Gastos

- Alimentação
- Mercado
- Moradia
- Transporte
- Saúde
- Lazer
- Assinaturas
- Compras
- Educação
- Pets
- Viagens
- Outros

## Entradas

- Salário
- Freelance / Trabalho extra
- Benefício
- Rendimentos
- Reembolso
- Venda
- Presente / Ajuda
- Outros

## Nota financeira

**Reembolso** é uma categoria de organização, não uma regra contábil. Um reembolso pode representar recuperação de um gasto anterior e não deve ser transformado automaticamente em renda econômica apenas por causa da categoria escolhida.

## Implementação

As sugestões são criadas atomicamente junto com uma nova Casa no bootstrap canônico do Supabase. Casas já existentes não são alteradas automaticamente, preservando personalizações feitas anteriormente.
