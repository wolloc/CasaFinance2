# Projeção encadeada — entradas previstas, empréstimos e perspectivas

Data: 2026-09-30

## DEFINIDO — fechamento projetado encadeado
A projeção financeira é contínua entre meses:

```text
fechamento projetado do mês N
= abertura do mês N
+ entradas previstas consideradas
- compromissos previstos

abertura do mês N+1
= fechamento projetado do mês N
```

O fechamento projetado de um mês pode alimentar meses seguintes mesmo antes de os fatos futuros serem realizados. Isso é planejamento, não alteração de saldo real.

## DEFINIDO — entradas futuras
- Uma entrada futura explicitamente cadastrada pelo usuário participa da projeção enquanto estiver prevista.
- Entrada prevista não aumenta o saldo atual e não é tratada como realizada.
- Entradas recorrentes materializadas no horizonte seguem a mesma regra.
- A Home atualiza o horizonte de entradas recorrentes antes de ler a projeção.
- Uma entrada futura normal não entra em **Precisa de atenção** apenas por estar prevista.
- Quando sua data chega/passa e ela continua sem recebimento ou revisão, torna-se item de conferência/atenção.
- Recebíveis de terceiros continuam fora desta regra: não melhoram a projeção de caixa antes do recebimento, conforme o motor financeiro.

## DEFINIDO — empréstimos
- Empréstimo tomado entra na projeção de saída conforme o cronograma canônico de `loan_schedule_items`.
- Cada parcela impacta o mês de seu vencimento.
- O principal inteiro da obrigação não pode ser somado novamente quando existe cronograma canônico.
- Amortização de principal continua sendo liquidação de passivo, não nova despesa.
- Juros e tarifas projetados participam do compromisso financeiro da parcela, mas só viram fatos econômicos quando efetivamente reconhecidos/materializados pelo fluxo canônico.
- Parcela vencida e não paga vira atenção e abre o detalhe do empréstimo.

## DEFINIDO — perspectivas
### Nossa Casa
Considera os recursos líquidos, entradas e compromissos da Casa inteira.

### Morador
Considera:
- liquidez canonicamente atribuída ao morador;
- entradas daquele morador;
- funding projetado atribuído aos recursos daquele morador;
- acertos programados de entrada/saída daquele morador.

Um compromisso sem rota individual comprovada não é debitado silenciosamente de nenhum morador. Ele permanece **sem atribuição individual** e deve ser sinalizado na perspectiva.

## DEFINIDO — patrimônio
Reserva e investimento continuam fora do saldo automático de fechamento. Podem aparecer como alternativa explícita de cobertura, mas não são convertidos em caixa pela projeção.

## IMPLEMENTADO nesta entrega
- entradas `forecast` explicitamente cadastradas passam a compor a projeção sem virar realizado;
- atualização do horizonte recorrente de entradas antes da Home;
- cronograma canônico de empréstimos integrado aos compromissos mensais;
- supressão da duplicidade entre cronograma e obrigação principal;
- parcela de empréstimo vencida roteada ao detalhe do contrato;
- compromissos sem rota individual permanecem não atribuídos e são sinalizados na visão do morador.
