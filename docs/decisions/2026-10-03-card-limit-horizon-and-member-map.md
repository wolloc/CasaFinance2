# Decisão — comprometimento de limite por horizonte e mapa de recursos por perspectiva

**Data:** 2026-10-03  
**Status:** DEFINIDO / IMPLEMENTADO — candidato a homologação

## Decisão

Na Home/Casa:

- A barra de comprometimento de cada cartão passa a ser segmentada visualmente:
  - **Neste mês:** compromissos da fatura/período atual.
  - **Próximos meses:** compromissos futuros já conhecidos.
  - O comprimento total da barra representa o limite comprometido em relação ao limite total do cartão.
- A seção **Onde está nosso dinheiro?** deve aparecer tanto na perspectiva **Casa** quanto nas perspectivas individuais de **Wallace** e **Guilherme**.
- O mesmo componente deve ser reutilizado nas diferentes perspectivas, evitando duplicação de UI.

## Regra de leitura

A soma visual dos segmentos representa o comprometimento conhecido do limite. O espaço restante representa limite ainda não comprometido. Os valores continuam sendo os mesmos dados financeiros já calculados; a alteração é principalmente de apresentação.

## Homologação pendente

Validar em Casa, Wallace e Guilherme:

1. cartão com valores neste mês e próximos meses;
2. barra segmentada proporcional ao limite;
3. mapa de recursos presente nas três perspectivas;
4. valores e cartões respeitando o filtro selecionado.
