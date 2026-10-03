# Decisão — posição inicial de cartão em lote, categoria e responsabilidade

Data: 2026-10-03

## DEFINIDO

A posição inicial de um cartão deve permitir reconstruir as compras anteriores ao início do controle sem obrigar o usuário a fazer um lançamento isolado por vez.

### Jornada detalhada

- cada compra histórica pode receber **categoria**;
- comprador permanece independente da responsabilidade econômica;
- responsabilidade pode ser:
  - 100% de um membro;
  - dividida igualmente;
  - personalizada por valor entre os membros;
- uma compra parcelada informa total de parcelas e quantas já foram pagas antes da data de corte;
- o usuário pode clicar em **Adicionar lançamento**, continuar cadastrando e revisar uma lista;
- todos os lançamentos da lista são salvos em **uma única operação atômica**;
- se um item do lote falhar, nenhum item do lote deve permanecer salvo;
- somente as parcelas ainda abertas passam a comprometer as faturas do período controlado;
- a posição inicial não cria pagamento, funding ou saída de caixa do período.

### Alternativa preservada

A opção **Só valor em aberto** permanece disponível quando o usuário não consegue recuperar o histórico detalhado. Essa alternativa não inventa categoria, comprador ou responsabilidade.

## PROPOSTO

Suavizar as cores da barra de limite comprometido dos cartões, usando tons menos saturados para manter a leitura da diferença entre **Neste mês** e **Próximos meses** sem transformar o cartão em um elemento visual dominante.

## Impacto

Esta evolução melhora principalmente a experiência de entrada de dados na virada para o uso real do Casa. Ela não altera as regras financeiras canônicas de compra, parcela, fatura, responsabilidade ou pagamento.
