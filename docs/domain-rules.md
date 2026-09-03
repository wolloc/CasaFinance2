# Regras de domínio do Casa Finance

Este documento é o contrato contábil de referência. Valores monetários são calculados em centavos; datas de competência usam `AAAA-MM`. As funções puras que materializam o contrato estão em `src/domain/finance.ts`.

## Glossário

| Conceito | Definição e efeito contábil |
| --- | --- |
| **Casa** | Unidade de isolamento e colaboração (`household`). Agrupa membros, contas, cartões, categorias e lançamentos. Dados de casas distintas nunca se compensam. |
| **Membro** | Pessoa vinculada à Casa. Pode comprar, registrar, ser titular de um meio, financiar ou ter responsabilidade econômica; os papéis são independentes. |
| **Conta** | Recurso financeiro com saldo realizado: conta corrente, poupança ou conta similar. Receita efetiva aumenta o saldo; despesa direta ou pagamento efetivo reduz o saldo. |
| **Carteira** | Meio com saldo próprio, físico ou digital. Contabilmente segue a mesma mecânica de uma Conta, mantendo identidade separada. |
| **Investimento** | Ativo financeiro pertencente à Casa ou a um membro. Aporte é transferência patrimonial, não despesa; rendimento é receita quando reconhecido. |
| **VA** | Vale-alimentação/refeição com saldo restrito. É uma origem financeira com saldo, não cartão de crédito nem receita a cada uso. |
| **Cartão** | Instrumento de crédito. Uma compra reconhece despesa e obrigação na fatura; não reduz conta bancária antes do pagamento. Titularidade não define responsabilidade econômica. |
| **Receita** | Ingresso que aumenta o resultado e, quando efetivado, o saldo da conta de destino. |
| **Despesa** | Consumo que reduz o resultado. É reconhecida na competência da compra/ocorrência, inclusive no cartão. |
| **Transferência** | Movimento entre ativos próprios. Debita uma origem e credita um destino pelo mesmo valor, preservando patrimônio e resultado. |
| **Pagamento de Fatura** | Liquidação da obrigação do cartão com uma conta escolhida. Reduz essa conta e a fatura; não cria despesa, pois as compras já a reconheceram. |
| **Empréstimo** | Origina ativo (valor recebido) e passivo (dívida), sem receita; amortização reduz ambos, e somente juros/tarifas são despesas. O modelo atual ainda não possui entidade própria. |
| **Comprador/Autor** | Pessoa que originou, realizou ou registrou a ação. Não determina, sozinho, quem pagou ou deve suportar o gasto. |
| **Origem Financeira** | Instrumento e rota do dinheiro (Conta, Carteira, VA ou Cartão). Seu titular pode diferir do comprador, financiador e responsável. |
| **Financiador Efetivo** | Membro cujos recursos próprios efetivamente liquidaram o gasto. Em cartão, existe apenas quando a fatura é paga; antes disso pode haver financiador projetado. |
| **Responsável Econômico** | Quem deve suportar economicamente a despesa, em 50/50, 100% ou divisão personalizada. A soma das responsabilidades deve fechar o total. |
| **Parcela** | Fração de uma compra atribuída a uma competência/fatura. A soma das parcelas em centavos deve ser exatamente o valor original. |
| **Conta Fixa** | Regra recorrente que gera uma ocorrência identificável por competência. A regra e a ocorrência não podem ser somadas simultaneamente. |

## Invariantes contábeis

1. **Resultado:** somente Receitas e Despesas alteram o resultado. Transferências, pagamentos de fatura, aportes e amortização de principal não alteram.
2. **Patrimônio em transferências:** débito e crédito têm o mesmo valor e são atômicos; a soma dos ativos permanece constante.
3. **Cartão:** compra efetiva aumenta despesa e fatura. O saldo bancário permanece intacto até a liquidação.
4. **Liquidação de cartão:** pagamento reduz somente a conta de origem selecionada e reduz a obrigação; a despesa não é reconhecida novamente.
5. **Real versus previsto:** saldo real incorpora apenas `effective`; projeção parte do real e aplica itens `planned`, sem transformar previsão em realização.
6. **Parcelamento:** o cálculo usa centavos inteiros. `100,00 / 3` produz `33,34 + 33,33 + 33,33`.
7. **Responsabilidade:** as parcelas econômicas somam exatamente o total da despesa.
8. **Acerto:** para cada membro, `saldo do acerto = recursos próprios financiados - responsabilidade econômica`. Saldo positivo é crédito; negativo é dívida. A soma deve ser zero.
9. **Papéis independentes:** comprador, titular do instrumento, financiador efetivo e responsáveis econômicos não são inferidos uns dos outros.
10. **Cartão no acerto:** antes do pagamento há obrigação/acerto projetado, não financiamento realizado. Depois do pagamento, a origem escolhida define o financiador realizado.
11. **Idempotência da projeção:** parcela ou ocorrência fixa é contada uma vez por seu ID estável e competência, mesmo se aparecer por mais de uma consulta.

## Contratos das funções puras

- `splitInstallments(total, count)` valida total e quantidade, reparte em centavos e distribui o resíduo pelas primeiras parcelas.
- `calculateFinancialPosition(input)` produz saldos realizados de contas, faturas, patrimônio, receitas, despesas e resultado. Entradas previstas são deliberadamente ignoradas.
- `calculateSettlement(memberIds, expenses, mode)` compara financiamento e responsabilidade no modo realizado ou projetado sem usar comprador/titular como atalhos.
- `calculateProjection(realBalance, month, commitments)` deduplica ocorrências pelo ID, inclui apenas previsões da competência e retorna o saldo projetado.

## Matriz de lançamentos

| Evento efetivo | Conta bancária | Fatura | Resultado | Acerto realizado |
| --- | ---: | ---: | ---: | --- |
| Receita | aumenta | — | aumenta | não se aplica |
| Despesa direta | diminui | — | diminui | origem identifica financiador |
| Compra no cartão | não muda | aumenta | diminui | aguarda liquidação |
| Pagamento de fatura | diminui | diminui | não muda | origem identifica financiador |
| Transferência própria | origem diminui/destino aumenta | — | não muda | não se aplica |

## Proteções automatizadas

`src/domain/finance.test.ts` cobre as dez regressões obrigatórias e também separa acerto de cartão realizado e projetado. Novas integrações no banco ou na API devem delegar a este módulo em vez de recriar fórmulas em componentes.
