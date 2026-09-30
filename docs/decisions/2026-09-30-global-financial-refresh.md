# Atualização automática após movimentações financeiras

Data: 2026-09-30

## DEFINIDO
Sempre que um fato financeiro ou movimentação for concluído com sucesso, o Casa Finance deve disparar uma revisão global dos dados exibidos.

Isso inclui, no mínimo:
- nova despesa;
- nova entrada ou confirmação de entrada;
- transferência entre recursos;
- acerto entre moradores;
- pagamento/adiantamento de fatura;
- aporte e resgate;
- alterações financeiras em entradas/recorrências que já expõem callback de conclusão.

## Comportamento
- não recarregar a página inteira;
- preservar a navegação e a perspectiva selecionada;
- reler Home, Entradas e Gastos a partir das fontes canônicas;
- a tela atual continua usando seu refresh local para feedback imediato;
- a Home relê dashboard, recursos, cartões, atenção, projeções e agenda quando recebe nova revisão global.

## Guardrail
A revisão global apenas invalida leituras de UI. Ela não cria, duplica ou altera fatos financeiros.
