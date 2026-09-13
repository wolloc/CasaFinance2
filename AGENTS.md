# Casa Finance — instruções para agentes de desenvolvimento

Este arquivo define regras permanentes para agentes de IA que trabalham neste repositório. Ele não substitui a documentação de produto e domínio em `docs/`; serve como contrato operacional para preservar a coerência do Casa Finance durante mudanças de código.

## 1. Contexto do produto

Casa Finance é um aplicativo de finanças pessoais já existente. **Não é um projeto greenfield.**

Antes de propor ou implementar mudanças relevantes:

1. inspecione a implementação atual;
2. leia a documentação de domínio aplicável;
3. preserve o que já funciona;
4. reutilize componentes, serviços, tabelas, RPCs e conceitos existentes sempre que possível;
5. corrija antes de reconstruir;
6. não crie soluções paralelas para problemas que o produto já resolveu.

O Product Owner não é desenvolvedor. Tome decisões técnicas que sejam consequência natural das regras já definidas, mas não transforme decisões técnicas em novas regras de produto sem necessidade.

## 2. Fontes de verdade

Antes de alterar comportamento financeiro, consulte os documentos relevantes, especialmente:

- `docs/casa-finance-constitution.md`
- `docs/domain-rules.md`
- `docs/product-spec-v2.md`
- `docs/current-architecture.md`
- `docs/financial-engine-v2.md`
- `docs/decisions/`

Quando documentação e código divergirem, não escolha silenciosamente um deles. Determine se a divergência é implementação incompleta, documentação desatualizada ou decisão ainda pendente e registre isso na entrega.

Use estes estados ao descrever produto e implementação:

- **IMPLEMENTADO** — existe atualmente no produto.
- **DEFINIDO** — regra ou comportamento já decidido, ainda que não implementado.
- **PROPOSTO** — sugestão ainda não aprovada.
- **PENDENTE** — assunto que precisa de decisão.
- **DEPRECADO** — comportamento ou decisão que não deve mais ser utilizado.

Nunca converta automaticamente uma hipótese ou sugestão em regra oficial.

## 3. Princípio central de UX e domínio

> O usuário conta o que aconteceu; o Casa interpreta financeiramente o acontecimento.

Mantenha o motor financeiro sofisticado quando necessário, mas não exponha conceitos internos na interface sem benefício claro ao usuário.

Toda mudança financeira deve perguntar primeiro:

> Esta ação cria um novo fato econômico ou apenas altera financiamento, pagamento, divisão, liquidação, correção, projeção ou apresentação de um fato existente?

Uma consequência de um fato já reconhecido não deve virar uma nova despesa ou receita.

## 4. Invariantes financeiras

Preserve estas regras, salvo decisão explícita documentada em contrário:

1. Uma despesa econômica é reconhecida exatamente uma vez.
2. Pagamento de fatura não cria nova despesa.
3. Pagamento de obrigação já reconhecida não cria nova despesa.
4. Devolução/reembolso de obrigação a terceiro é liquidação, não nova despesa.
5. Compra no cartão reconhece a despesa na data econômica e cria compromisso de cartão/fatura; não reduz conta bancária no momento da compra.
6. Compra parcelada é uma única despesa econômica. Parcelas são compromissos financeiros futuros, não despesas recorrentes.
7. Pagamento de fatura reduz caixa e liquida compromissos; não reconhece novamente os itens da fatura.
8. Pix por cartão é financiamento via cartão, não saída imediata de uma conta bancária.
9. Encargos financeiros de Pix por cartão são fato econômico separado do principal e herdam a mesma distribuição de responsabilidade econômica do principal.
10. Quando terceiro paga uma despesa, não invente saída de caixa da Casa. Se houver valor a devolver, represente uma obrigação; sua liquidação futura não cria outra despesa.
11. Recorrências futuras são projeções. Confirmar uma ocorrência deve vinculá-la/convertê-la em fato real sem duplicação econômica.
12. Conta, carteira/dinheiro e benefício reduzem o respectivo saldo quando efetivamente utilizados.
13. Comprador/autor, titular do cartão, responsável econômico e financiador/pagador são papéis independentes.
14. Projeção não é fato realizado.
15. Histórico financeiro deve permanecer auditável.

## 5. Modelagem e persistência

O modelo financeiro existente é a base. Não crie um segundo motor financeiro.

Entidades canônicas relevantes incluem, entre outras:

- `transactions`
- `transaction_components`
- `transaction_links`
- `economic_allocations`
- `account_balance_events`
- `money_movements`
- `funding_events`
- `financial_obligations`
- `obligation_events`
- `cards`
- `card_invoices`
- `installments`
- `card_invoice_payments`
- `financing_allocations`
- `recurring_rules`
- `recurring_occurrences`

Antes de criar tabela, coluna, view, RPC ou serviço novo, verifique se o conceito já é representado pelo modelo existente.

### Migrations

- Migrations existentes são imutáveis.
- **Nunca edite uma migration histórica para corrigir produção/staging.**
- Toda evolução de banco deve ser forward-only em nova migration.
- Preserve RLS, isolamento por `household_id`, integridade referencial e idempotência.
- Não aumente timeouts para mascarar consultas lentas sem antes identificar a causa.

## 6. Nova Despesa

A Nova Despesa já existe e deve ser evoluída incrementalmente, não reescrita.

Princípios definidos:

- comprador significa quem originou/fez o gasto; não significa pagador, titular do cartão ou responsável;
- data é obrigatória, somente data, sem horário;
- data futura não é aceita em Nova Despesa;
- lançamentos retroativos devem entrar na lógica financeira correspondente à data histórica;
- descrição (`Com o que gastou?`) é obrigatória;
- `Onde/com quem?` é opcional;
- categoria é opcional e pode ser atribuída posteriormente;
- valor e responsabilidade econômica são obrigatórios;
- empréstimo não pertence ao fluxo de Nova Despesa;
- responsabilidade e meio de pagamento devem permanecer independentes.

Meios de pagamento relevantes incluem conta/Pix, carteira/dinheiro, VA/VR/benefício, cartão de crédito, Pix por cartão e pagamento por terceiro.

Não reintroduza detalhes internos do motor na UI apenas porque existem no banco.

## 7. Gastos e compromissos

O menu Gastos deve representar duas lentes do mesmo universo financeiro, sem duplicar fatos:

### Gastos realizados

Responde: **“Com o que gastamos neste mês?”**

Usa a data econômica do fato. Uma compra de R$ 1.000 em outubro parcelada em 10x representa R$ 1.000 de gasto realizado em outubro.

### Compromissos do mês

Responde: **“O que impactou ou ainda deve impactar financeiramente este mês?”**

Usa o período do impacto financeiro efetivo ou esperado e pode incluir gastos imediatos, parcelas, obrigações, recorrências previstas e outros compromissos projetados.

O pagamento da fatura não deve aparecer como uma nova linha de gasto em `Gastos > Compromissos`. Exiba os compromissos subjacentes; o pagamento é liquidação.

Evite apresentar simultaneamente listas redundantes que façam o mesmo fato parecer duplicado. Diferencie claramente lente econômica e lente financeira.

## 8. Cartões, parcelas e faturas

Preserve a relação entre compra, parcelas, fatura, limite e pagamento como representações/consequências do mesmo fato econômico.

- Fatura agrega compromissos do ciclo.
- Fatura atual não é sinônimo de limite comprometido.
- Parcelamento não deve multiplicar o fato econômico.
- Arredondamento deve fechar exatamente o valor total em centavos.
- Pagamento parcial de fatura liquida somente a parte correspondente.
- Não duplique despesa ao liquidar cartão.

Ao investigar performance de cartão/parcelas, prove o gargalo com testes, logs ou instrumentação antes de alterar invariantes ou adicionar migrations especulativas.

## 9. Terceiros

Responsabilidade econômica e funding de terceiro são conceitos independentes.

Exemplos conceituais:

- terceiro paga e não há devolução: funding externo sem saída de caixa da Casa e sem obrigação;
- terceiro paga e há devolução: funding externo + obrigação;
- terceiro é responsável por parte do gasto: essa parcela da responsabilidade não deve virar obrigação da Casa apenas porque ele também pagou;
- pagamento futuro de obrigação a terceiro é liquidação de caixa, não nova despesa.

Reutilize `financial_parties`, `economic_allocations`, obrigações e eventos canônicos existentes antes de criar estruturas paralelas.

## 10. Recorrência e projeções

- Regra recorrente gera expectativas/projeções futuras, não despesas realizadas antecipadamente.
- Ocorrência confirmada deve ser ligada ao fato realizado sem duplicidade.
- Edição de uma ocorrência e edição da série são operações distintas.
- Encerrar recorrência não deve apagar fatos históricos já realizados.

## 11. Decisões pendentes

Não decida silenciosamente questões ainda marcadas como pendentes. Exemplos conhecidos:

- fonte e escopo do calendário de feriados para ajuste de dias úteis;
- comportamento exato no dia de fechamento de cartão quando depender da regra do emissor.

Se uma decisão pendente bloquear uma implementação, apresente ao PM:

1. lacuna;
2. por que importa;
3. recomendação principal;
4. impactos relevantes;
5. decisão necessária.

## 12. UX e UI

O produto é mobile-first.

Avalie não apenas funcionamento técnico, mas também:

- clareza;
- hierarquia;
- número de ações;
- feedback;
- prevenção de erros;
- consistência;
- risco de duplicidade;
- coerência com o modelo financeiro.

Não trate como regra aprovada uma melhoria visual ainda apenas proposta.

Quando uma requisição financeira puder ter sido persistida apesar de erro de rede/timeout, não incentive retry cego. Preserve idempotência e desenhe feedback que evite duplicidade.

## 13. Desenvolvimento

Prioridades técnicas:

1. preservar o que funciona;
2. corrigir antes de reconstruir;
3. reutilizar estruturas existentes;
4. simplicidade;
5. consistência financeira e de dados;
6. segurança;
7. escalabilidade quando houver necessidade concreta.

Ao alterar domínio financeiro:

- leia a implementação atual antes;
- procure chamadas indiretas, triggers e views afetadas;
- considere efeitos em caixa, competência, responsabilidade, funding, obrigações, cartões e projeções;
- adicione testes de regressão;
- teste arredondamentos em centavos;
- teste retries/idempotência quando houver escrita remota;
- não altere regra de produto apenas para fazer teste passar.

Contratos puros existentes em `src/domain/ledger.ts` e `src/domain/finance.ts` devem ser reutilizados/respeitados quando aplicáveis.

## 14. Git e entrega

Não faça desenvolvimento diretamente na `main`.

Fluxo padrão:

1. partir da `main` atualizada;
2. criar branch específica;
3. implementar mudança focada;
4. executar testes relevantes e suite de CI;
5. abrir PR com resumo e riscos;
6. corrigir falhas do CI na própria branch;
7. fazer merge somente com checks verdes.

Não misture grandes frentes independentes em uma única PR quando isso dificultar revisão ou rollback.

Mudanças que exigirem nova migration devem informar explicitamente ao PM que o ambiente Supabase precisa receber `supabase db push` após o merge.

## 15. Forma de trabalhar com o PM

Se o comportamento já estiver **DEFINIDO**, prossiga autonomamente nas decisões técnicas necessárias para implementá-lo.

Interrompa e peça decisão somente quando:

- houver conflito real entre regras;
- uma regra de produto estiver ausente e bloquear o trabalho;
- houver duas alternativas com impacto material de produto/finanças;
- a solução implicar mudança estrutural relevante não coberta pelas decisões existentes.

Não peça autorização para cada edição de arquivo, refactor local ou decisão técnica reversível.

Ao concluir uma tarefa, informe de forma objetiva:

- o que mudou;
- quais regras foram preservadas;
- testes executados e resultado;
- migrations criadas, se houver;
- riscos ou pendências;
- se Staging/Supabase precisa ser atualizado;
- PR e estado do CI/merge.

## 16. Segurança contra regressões financeiras

Antes de considerar uma alteração concluída, verifique explicitamente que ela não causou:

- despesa ou receita duplicada;
- saída/entrada de caixa inventada;
- responsabilidade econômica atribuída à pessoa errada;
- pagamento tratado como novo fato econômico;
- parcela tratada como recorrência;
- projeção tratada como realizado;
- perda de histórico auditável;
- quebra de isolamento entre casas;
- retry criando fato duplicado;
- inconsistência entre total, parcelas, fatura e liquidações.

Quando houver dúvida, prefira preservar os fatos canônicos existentes e tornar a interpretação derivada corrigível, em vez de criar novos fatos para compensar inconsistências.