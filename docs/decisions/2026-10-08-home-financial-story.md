# Decisão — Casa como fotografia + projeção viva

**Data:** 2026-10-08  
**Status:** DEFINIDO

## Direção

A Home/Casa deve priorizar a leitura da situação financeira como uma fotografia que evolui ao longo do mês.

### Como estamos?

A seção mantém o fechamento projetado como principal destaque, mas passa a separar:

- início do mês;
- efetivo já ocorrido — o que entrou e o que saiu;
- ainda previsto — o que deve entrar e o que ainda deve sair;
- fechamento projetado caso o cenário conhecido se confirme.

O valor projetado é dinâmico: novos lançamentos, pagamentos, recebimentos e compromissos alteram a fotografia.

### Disponível agora

"Disponível agora" representa os recursos que a Casa consegue movimentar no presente, respeitando as restrições de cada recurso. Benefícios utilizáveis permanecem incluídos nessa visão, embora sejam visualmente identificados como recurso restrito a seu uso.

Reservas e investimentos permanecem separados do dinheiro para movimentação cotidiana.

### Onde está nosso dinheiro?

Contas e cartões continuam sendo grupos principais.

Cada recurso deve poder mostrar, além do saldo atual, uma sinalização de como tende a terminar o mês com as entradas e saídas projetadas que possuem rota conhecida.

A projeção por conta é uma informação de planejamento, nunca evidência de pagamento realizado.

### Pessoas e acertos

"Responsabilidades de terceiros" e "Outras pessoas" passam a ser uma única experiência chamada **Pessoas e acertos**, reunindo:

- compromissos assumidos por terceiros;
- valores a receber ou pagar;
- acertos projetados entre Wallace e Guilherme;
- situação efetiva versus tendência projetada.

### Terceiros na projeção

Recebíveis de terceiros em aberto podem compor a projeção de entrada do mês. Eles continuam sendo uma expectativa e não são convertidos em receita efetiva até o recebimento real.

Pagamentos/compromissos devidos a terceiros continuam compondo as saídas projetadas normalmente.

## Limites desta entrega

A comparação histórica detalhada entre "o que já estava registrado no primeiro dia" e "o que foi adicionado durante o mês" exige uma leitura temporal própria das datas de criação dos compromissos e previsões. Não deve ser inferida apenas do saldo atual.

Essa comparação fica como próxima evolução da mesma frente, sem alterar fatos financeiros existentes.

## Não alterado nesta decisão

- "Precisa de atenção" será refinado em frente própria.
- "Olhando pra frente" permanece como está.
- O motor financeiro canônico continua sendo a fonte dos cálculos.
- Pagamentos realizados continuam separados de previsões.
- Titularidade de cartão não determina quem efetivamente financia a fatura.


## Evolução temporal definida em 2026-10-08

A projeção da Casa deve ser tratada como uma cadeia mensal, não como uma fotografia isolada:

- o dia de corte e a posição inicial inauguram o acompanhamento financeiro;
- enquanto o mês está aberto, o fechamento projetado alimenta o cenário dos meses seguintes;
- quando o mês é encerrado, o fechamento realizado passa a ser a abertura real do mês seguinte;
- previsões nunca são convertidas automaticamente em fatos realizados;
- a mesma linha temporal deve existir para a visão consolidada da Casa e para as perspectivas individuais de Wallace e Guilherme;
- a perspectiva individual respeita responsabilidade econômica, funding e acertos, sem dividir valores artificialmente.

A função canônica `financial_monthly_projection` já encadeia o fechamento projetado de um mês como abertura do seguinte, e `financial_member_monthly_projection` fornece a perspectiva individual. A Home deve consumir essas fontes como referência temporal, evitando criar um segundo motor de projeção.

A projeção por recurso permanece complementar: ela explica como contas e outros recursos tendem a terminar o mês, mas não substitui a cadeia financeira mensal canônica.
