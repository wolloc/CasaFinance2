# Regras de domínio do Casa Finance

Este documento registra as **invariantes permanentes do domínio financeiro do Casa**. Valores monetários são calculados em centavos. Regras de apresentação calibráveis pertencem à especificação de produto; não são invariantes contábeis.

## Glossário

| Conceito | Definição e efeito financeiro |
| --- | --- |
| **Casa** | Unidade de isolamento, colaboração, segurança e consolidação (`household`), composta por um ou dois membros ativos. Casa não é proprietária de dinheiro, patrimônio, dívida, direito ou obrigação; recursos pertencem a membros ou terceiros. Dados de Casas distintas nunca se misturam nem se compensam. |
| **Membro** | Pessoa da Casa que pode registrar, comprar, ser titular, responsável ou funder; esses papéis são independentes. |
| **Evento econômico** | Fato que reconhece receita, despesa, rendimento, perda ou outro efeito econômico uma única vez, independentemente de como e quando será financiado. |
| **Conta / dinheiro físico** | Recurso transacional cujo saldo realizado compõe o caixa atual. Dinheiro físico tem localização própria; saque e depósito são transferências. |
| **Investimento / reserva** | Ativo separado do caixa rotineiramente disponível. Aporte e resgate de principal são transferências patrimoniais; rendimento ou perda são fatos econômicos separados. |
| **Benefício (VA/VR)** | Recurso de uso restrito. Carga não é salário; uso reconhece a despesa econômica correspondente. |
| **Cartão** | Exposição de crédito. Compra reconhece um evento econômico e gera compromissos; fatura agrega compromissos e pagamento liquida caixa/funding sem reconhecer nova despesa. |
| **Receita** | Entrada verdadeira que aumenta o resultado, como salário, aluguel, freelance, bônus, presente ou rendimento. Nem toda entrada de caixa é receita. |
| **Despesa** | Consumo que reduz o resultado e é reconhecido uma única vez. Parcelamento ou financiamento não multiplica a despesa. |
| **Transferência** | Movimento entre ativos próprios, com duas pernas atômicas e efeito zero em receita e despesa. |
| **Empréstimo** | Direito ou dever financeiro. Novos empréstimos são representáveis por `financial_obligations`, movimentos e componentes: principal concedido não é despesa, principal tomado não é renda e somente juros, tarifas e perdas têm efeito econômico próprio. |
| **Comprador / autor do gasto** | Membro que originou/realizou a compra ou gasto. Não determina titularidade, responsabilidade econômica, funding ou pagador. |
| **Responsabilidade econômica** | Parcela do fato econômico que uma pessoa deve suportar. A soma das allocations deve fechar o valor aplicável. Não existe percentual permanente por membro. |
| **Funding realizado** | Recurso que efetivamente liquidou o compromisso, atribuído ao membro ou terceiro correspondente. No cartão, surge quando a fatura é paga, não pela titularidade. |
| **Funding projetado** | Recurso/membro previsto para liquidar um compromisso futuro conhecido. Não altera caixa realizado. |
| **Acerto** | Conta-corrente contínua entre membros, sem reset mensal, derivada da diferença entre funding e responsabilidade no mesmo estado e nos compromissos correspondentes. Sua liquidação é explícita. |
| **Recebível** | Direito contra terceiro. Seu recebimento reduz a obrigação e movimenta caixa, mas não cria renda novamente. |
| **Pagável** | Dever a terceiro. Seu saldo aberto compromete a projeção; pagamento reduz a obrigação e movimenta caixa sem duplicar a despesa de origem. |
| **Parcela** | Compromisso financeiro de uma compra atribuído a mês financeiro/fatura. As parcelas fecham o valor financiado em centavos, mas não são novas despesas econômicas. |
| **Mês financeiro** | Mês ao qual um compromisso, entrada ou indicador de planejamento pertence; pode diferir da data econômica e da data de caixa. |
| **Pendência anterior** | Item previsto/confirmado cujo prazo passou sem resolução. Continua aberto e carregado para a projeção, sem mudar silenciosamente sua data ou estado de origem. |
| **Recorrência** | Regra que produz ocorrências identificáveis. Regra e ocorrência nunca são somadas simultaneamente; estimativas variáveis futuras são preservadas. |
| **LIS** | Crédito bancário utilizado/disponível. Uso pode tornar o saldo negativo; limite disponível nunca é somado ao dinheiro. |

## Invariantes permanentes

1. **Caixa não é resultado.** Somente fatos econômicos de receita/despesa/rendimento/perda alteram resultado. Transferências, acertos, pagamento de fatura, principal de empréstimo e aporte/resgate não o alteram.
2. **Reconhecimento econômico único.** Uma despesa é reconhecida uma vez na origem. Compra, parcela, fatura, limite usado e pagamento são representações vinculadas, nunca despesas cumulativas.
3. **Papéis independentes.** Titular, comprador/autor, registrador, responsável econômico, funder realizado, funder projetado e terceiro pagador não são inferidos automaticamente uns dos outros.
4. **Responsabilidade fecha o fato econômico.** As allocations econômicas não podem ultrapassar o valor aplicável e devem fechar integralmente esse valor antes da conclusão do fato. Funding não substitui responsabilidade.
5. **Três relógios.** Data econômica, mês financeiro e data de caixa são independentes. Uma inclusão retroativa preserva a data econômica informada e recalcula suas consequências correspondentes; a data de cadastro não substitui silenciosamente a data do fato.
6. **Valor efetivo único.** Cada cálculo usa `realized` quando aplicável; senão `confirmed`; senão `estimated`/`forecast`. As versões jamais são somadas.
7. **Previsto não é realizado.** A passagem do tempo não realiza eventos nem caixa. Um forecast vencido vira pendência anterior até confirmação, realização, correção ou cancelamento rastreável.
8. **Realização parcial preserva estado.** `confirmed 1.000` com `realized_amount 400` permanece `confirmed`; somente a realização completa passa a `realized`. Não se cria estado `partial` apenas para esse caso.
9. **Cartão sem duplicidade.** A compra cria o evento econômico e compromissos; a fatura os agrega; o pagamento realiza caixa/funding e não cria nova despesa nem novo acerto. O pagamento de fatura é liquidação financeira, não um novo compromisso de gasto.
10. **Parcelamento não parcela a despesa econômica.** O evento econômico ocorre uma vez; parcelas distribuem compromissos pelos meses financeiros. Em centavos, `100,00 / 3` resulta em `33,34 + 33,33 + 33,33`.
11. **Pix por cartão preserva principal e encargo.** O principal reconhece a despesa original uma única vez; tarifas/juros são componentes econômicos financeiros separados; principal + encargos formam o valor financiado no cartão. Não há saída imediata de conta bancária apenas por usar Pix financiado pelo cartão.
12. **Terceiro pagador não redefine responsabilidade.** Se um terceiro fornece o recurso, o fato econômico continua alocado a quem deve suportá-lo. Se houver devolução, nasce pagável ao terceiro apenas pela parcela que cabe à Casa e ainda precisa ser reembolsada; sua liquidação não cria nova despesa. Sem devolução, não nasce pagável.
13. **Acerto contínuo e por estado.** Não há reset mensal nem compensação implícita. Para cada membro: **acerto realizado = funding realizado − responsabilidade correspondente**; **acerto projetado = funding projetado − responsabilidade dos compromissos futuros correspondentes**. Realizado e projetado permanecem distinguíveis.
14. **Acerto projetado no cartão nasce na compra.** Compromissos futuros conhecidos permitem projetar funding e distribuir o acerto nos mesmos meses financeiros da compra. Titular do cartão não vira funder realizado; o pagamento posterior apenas materializa o funding já relacionado e não gera outro acerto.
15. **Principal de empréstimo é neutro.** Concessão cria recebível e saída de caixa; tomada cria pagável e entrada de caixa. Amortização reduz principal. Juros, tarifas e perdas são eventos econômicos separados.
16. **Recebível é conservador.** Recebível de terceiro não aumenta a projeção principal antes do recebimento. Sua liquidação aumenta caixa e reduz o direito, com renda zero.
17. **Pagável é conservador.** Todo pagável aberto compromete a projeção. Uma posição líquida pode ser exibida, mas nunca quita ou compensa automaticamente obrigações brutas.
18. **Liquidação parcial reduz somente o aberto.** Pagamento parcial de fatura, pagável ou outra obrigação reduz caixa e obrigação somente pelo montante efetivamente liquidado; o saldo restante permanece aberto e não se reconhece novamente o fato econômico de origem.
19. **Conta conjunta mantém responsabilidade econômica independente, mas funding realizado é 50/50.** A Casa considera 100% do saldo e as perspectivas individuais de liquidez atribuem 50% para cada titular. Quando uma saída efetivamente ocorre por uma conta conjunta de dois membros, o funding realizado é atribuído 50/50 entre os titulares. Isso não altera a responsabilidade econômica do gasto, que continua definida pelas allocations do fato.
20. **Saldo real é realizado.** Deriva de `account_balance_events` canônicos e `money_movements` realizados. Forecast, benefícios, reservas, investimentos, recebíveis, limite de cartão e LIS disponível não aumentam o saldo atual.
21. **Vínculo com origem.** Refunds, pagamentos, liquidações, encargos, financiamentos e correções preservam relação auditável com o fato original. Refund não é renda comum.
22. **Recorrência projeta, não antecipa resultado.** Uma regra recorrente pode gerar compromissos/ocorrências futuras, mas esses forecasts não são despesas econômicas realizadas antes da ocorrência efetiva. Confirmação/realização deve reutilizar ou vincular a ocorrência, nunca duplicá-la. Em cartão, a projeção entra na fatura/compromisso esperado sem consumir limite real; só a cobrança confirmada consome limite e a liquidação posterior continua sendo pagamento de fatura.
23. **Passado é corrigido, não apagado.** Depois de efeitos dependentes, correções preservam histórico e recalculam o futuro. Exclusão financeira não é fluxo normal.
24. **Atomicidade.** Operações compostas — transferências, pagamentos, correções, refunds e liquidações — gravam todas as pernas ou nenhuma. O frontend não coordena updates financeiros independentes.
25. **Auditabilidade e idempotência.** Autor, Casa, origem, estado, valores e vínculos são rastreáveis. Ocorrências, parcelas e comandos repetidos não podem duplicar efeitos.
26. **Entrada preserva beneficiário e destino.** A pessoa beneficiária da renda é definida independentemente da conta de destino. Em conta individual, a UX pode restringir os destinos às contas daquela pessoa e derivar essa associação automaticamente; conta conjunta pode ser destino de qualquer titular sem transformar a renda em renda conjunta.
27. **Transferência entre membros pode liquidar acerto existente.** Quando dinheiro realizado sai de recurso exclusivo de um membro e entra em recurso exclusivo do outro, o Casa primeiro aplica o valor à posição realizada de acerto existente no mesmo sentido. O excedente nunca cria renda/despesa e exige intenção explícita: pode permanecer como valor a favor do remetente ou ser uma transferência definitiva sem devolução. Nenhuma dívida inversa nasce silenciosamente.
28. **Roteamento financeiro preserva os comandos canônicos.** A interface descreve o acontecimento em linguagem cotidiana; o Casa escolhe por trás o comando financeiro compatível com recurso, origem, destino, titularidade e contexto. Essa camada não funde conceitos contábeis distintos nem autoriza o frontend a coordenar escritas financeiras independentes.

## Matriz resumida

| Fato | Resultado | Caixa realizado | Obrigação / vínculo |
| --- | --- | --- | --- |
| Renda recebida | receita uma vez | aumenta | liquida a entrada esperada, quando houver |
| Despesa direta | despesa uma vez | diminui | funding realizado e responsabilidades vinculados |
| Compra no cartão | despesa uma vez | não muda | compromissos, allocations e acerto projetado |
| Pix por cartão | despesa principal + encargos financeiros separados | não muda no ato | compromisso financiado no cartão |
| Terceiro paga despesa da Casa | despesa uma vez | não muda no ato | pagável somente se houver devolução |
| Pagamento de fatura | zero | diminui | reduz fatura e realiza funding; sem novo acerto |
| Pagamento de pagável | zero, salvo encargos próprios | diminui | reduz pagável |
| Transferência / saque / depósito | zero | duas pernas | mesmo evento e patrimônio preservado |
| Recebimento de recebível | zero | aumenta | reduz recebível |
| Principal de empréstimo | zero | entra ou sai | cria/reduz receivable ou payable |
| Aporte/resgate | zero | move entre classes | principal patrimonial preservado |
| Refund | reverte total/parcialmente a origem | conforme rota efetiva | mantém vínculo e não é renda comum |

## Acerto e cartão

O fluxo obrigatório é:

```text
Compra
→ evento econômico
→ compromisso financeiro
→ responsabilidade
→ acerto projetado

Fatura
→ agrega compromissos

Pagamento
→ realiza caixa/funding
→ liquida compromissos na extensão paga
→ não cria nova despesa
→ não cria novo acerto
```

Transferir mais do que a posição de acerto não cria dívida inversa silenciosamente. O valor correspondente à posição existente pode liquidá-la automaticamente; o excedente exige intenção explícita e classificação própria. Se o remetente abrir mão do excedente, ele permanece uma transferência patrimonial entre membros e não é classificado como renda da Casa.

## Contratos puros existentes

- `splitInstallments(total, count)` reparte centavos e fecha exatamente o total.
- `calculateFinancialPosition(input)` calcula posições realizadas sem transformar previsões em saldo.
- `calculateSettlement(memberIds, expenses, mode)` separa cálculo realizado do projetado.
- `calculateProjection(realBalance, month, commitments)` deduplica ocorrências estáveis.
- `projectDashboardFromLedger(ledger, resources, position)` impede fórmulas contábeis duplicadas em componentes.

`src/domain/ledger.ts` e `src/domain/finance.ts` implementam e testam regras puras. Eles não têm autoridade acima do banco: na aplicação autenticada, o Supabase persistido e seus read models canônicos são as fontes. Frontend, banco e funções puras devem respeitar este mesmo contrato.

## Fontes canônicas

| Conceito | Fonte persistida presente/futura |
| --- | --- |
| Evento econômico | `transactions`, `transaction_components`, `transaction_links` |
| Responsabilidade | `economic_allocations` |
| Caixa | `account_balance_events` + `money_movements` realizados |
| Funding | `funding_events` (realizado; o projetado requer evolução explícita) |
| Titularidade | `account_ownerships` |
| Terceiros | `financial_parties` |
| Direitos e deveres | `financial_obligations` + `obligation_events` |
| Cartão | `cards`, `card_invoices`, `installments`, `card_invoice_payments`, `financing_allocations` |
| Recorrência | `recurring_rules` + `recurring_occurrences` |

As migrations 001–021 já aplicadas são imutáveis. Evoluções começam em 022+, sem congelar aqui sua quantidade ou seus nomes.

## Não são fontes canônicas

- `DatabaseStore`, dados demo e IDs fake;
- `ApiService`, `AppContent` e dashboard legados;
- cálculos ad hoc em React;
- `accounts.opening_balance` legado como fonte futura;
- `transaction_splits` para novos fluxos.

Esses artefatos podem permanecer para compatibilidade, mas não devem ser reativados, ligados a usuários Supabase nem usados para reinterpretar fatos autenticados.

## Saúde e confiança

Saúde financeira e confiança da projeção são conceitos diferentes. Faixas green/yellow/red e seus percentuais são regras calibráveis de produto, não invariantes contábeis. A confiança é qualitativa e depende da atualização/confirmação dos dados; não deve ser convertida em percentual artificial.

## Proteções automatizadas

Os testes existentes em `src/domain/finance.test.ts` e `src/domain/ledger.test.ts` preservam contratos puros, tipos de evento, realizado versus projetado, funding, responsabilidades, empréstimos e estorno rastreável. Novas integrações devem ampliar essa cobertura e usar comandos persistidos atômicos, sem recriar fórmulas em componentes.
