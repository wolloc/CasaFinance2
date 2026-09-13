# VA/VR/benefício não suporta recorrência de gastos

**Status: DEFINIDO**

## Decisão

Gastos pagos com VA, VR ou outro recurso do tipo benefício **não podem ativar recorrência** no Casa Finance.

Cada uso do benefício é registrado individualmente quando efetivamente acontece.

A regra vale tanto para a finalização de **Nova despesa** quanto para a criação posterior de uma série a partir de um gasto já existente.

## Consequências de produto

- a opção de recorrência fica indisponível quando o gasto usa VA/VR/benefício;
- gastos históricos pagos com benefício não aparecem como referência elegível para criar uma série;
- o backend também rejeita a criação de regra recorrente baseada em benefício, evitando bypass por UI ou integração;
- o saldo do benefício continua sendo reduzido somente por usos efetivamente registrados.

Esta é uma regra de produto, não uma limitação temporária de implementação.
