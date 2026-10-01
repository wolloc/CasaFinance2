# Refinos Home e ações financeiras — empréstimos, terceiros e entre moradores

Data: 2026-10-01

## DEFINIDO — empréstimos
- O principal recebido entra no recurso escolhido e não é renda.
- As parcelas em aberto do cronograma reduzem a projeção dos meses em que vencem.
- O detalhe do empréstimo deve explicar explicitamente esse impacto.
- Após registrar um empréstimo em uma ação contextual, o modal fecha, a Home é relida e o usuário recebe confirmação curta.

## DEFINIDO — valores com terceiros
- Recebimentos e pagamentos com terceiros devem pedir explicitamente o recurso real de entrada/saída.
- A escolha do recurso segue o padrão visual de cards usado nas demais jornadas financeiras.
- Após salvar, a ação contextual fecha e a Home é relida.
- A liquidação reduz a obrigação sem criar nova renda ou novo gasto.

## DEFINIDO — entre moradores
- O bloco **Entre vocês** na Home é uma posição + porta para histórico.
- Ao expandir a relação, o usuário deve acessar o extrato dos eventos realizados e compromissos projetados.
- Transferências/acertos aparecem no histórico sem criar renda ou gasto novo.

## DEFINIDO — Home
- A frase de fechamento deve respeitar a perspectiva selecionada: **Casa**, **Wallace**, **Luiz** ou outro morador.
- A Home não repete texto explicativo quando o próprio número/estrutura já comunica o significado.
- O cabeçalho de **Onde está nosso dinheiro?** não repete total de recursos já exibido em **Contas**.

## IMPLEMENTADO — candidato de homologação
- callbacks de conclusão para empréstimo e liquidação com terceiros;
- seleção visual de conta em valores com terceiros;
- histórico de relação entre moradores acessível pela Home;
- microcopy do resumo mensal por perspectiva;
- remoção de textos e totais duplicados;
- explicação do impacto do cronograma do empréstimo na projeção.
