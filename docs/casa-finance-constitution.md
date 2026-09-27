# Casa Finance — Constituição Financeira

Este documento registra os invariantes de produto e contabilidade doméstica que devem orientar toda implementação do Casa Finance. Ele complementa `docs/product-spec-v2.md`: o Product Spec define experiência, navegação e comportamento esperado; esta Constituição define o que uma implementação nunca pode reinterpretar silenciosamente.

## Regra de precedência

Ao desenvolver ou revisar uma mudança:

1. preservar os mandamentos e motores deste documento;
2. seguir `docs/product-spec-v2.md` para UX e comportamento do produto;
3. usar migrations, RPCs, views/read models e testes como fonte da implementação técnica vigente;
4. se houver conflito ou ambiguidade, não inventar semântica financeira no frontend: parar a mudança e explicitar a decisão necessária.

## Os 11 mandamentos

1. **Movimentação de caixa não é automaticamente receita ou despesa.** Transferências patrimoniais não criam resultado econômico.
2. **Uma despesa econômica é reconhecida uma única vez.** Parcelas, fatura, pagamento da fatura, funding e acertos não podem duplicar a despesa original.
3. **Comprador, titular do instrumento, responsável econômico e pagador/funder são independentes.** Nenhum desses papéis pode ser inferido silenciosamente a partir de outro.
4. **Previsto não é realizado.** Uma previsão pode afetar projeção e atenção, mas não altera caixa realizado.
5. **Todo evento posterior mantém vínculo com o fato original.** Correção, cancelamento, refund, funding, parcela, fatura e liquidação devem permanecer rastreáveis.
6. **Financiamento não altera a natureza econômica.** Parcelar, usar cartão ou receber funding não transforma a natureza da compra.
7. **Data econômica, mês financeiro e data de caixa são relógios diferentes.** O produto deve preservar os três quando aplicáveis.
8. **O passado financeiro não é apagado.** `DELETE` destrutivo e UPDATE que reescreva fatos já materializados não são fluxos financeiros normais; correções devem preservar histórico.
9. **Toda entrada de dinheiro precisa ter natureza explícita.** Salário, transferência, empréstimo, recebível, acerto, refund e resgate de principal não são equivalentes.
10. **O usuário conta o que aconteceu; o Casa interpreta financeiramente o acontecimento.** A UX não deve exigir que o usuário pense como contador.
11. **Se o Casa não consegue interpretar uma ação com segurança, ele não deve fingir que consegue.** Falhas de leitura não viram zero; funding desconhecido não é atribuído; rotas de refund ou responsabilidade não são adivinhadas.

## Os 6 motores

Toda funcionalidade financeira deve declarar em quais motores atua:

| Motor | Pergunta |
| --- | --- |
| **Economia** | O que aconteceu economicamente? |
| **Responsabilidade** | Quem deve assumir economicamente esse valor? |
| **Compromisso** | Quem deve o quê, quanto e quando? |
| **Funding** | Quem colocou ou colocará o recurso? |
| **Caixa** | Onde o dinheiro efetivamente entrou ou saiu? |
| **História** | O que mudou depois e qual fato original explica essa mudança? |

Uma mudança que não consegue identificar seu motor deve ser tratada como semanticamente incompleta antes do merge.

## Papéis independentes em uma despesa

Uma compra pode ter, simultaneamente:

- **comprador**: quem originou/realizou a compra;
- **titular do instrumento**: dono do cartão/conta usado como instrumento;
- **responsável econômico**: quem deve suportar o gasto e em qual valor;
- **funder/pagador**: de quais recursos o dinheiro efetivamente saiu ou sairá;
- **liquidação posterior**: acerto que pode surgir entre membros ou com terceiros.

Exemplo: Guilherme compra uma TV de R$ 4.000 no cartão Porto de Wallace, com responsabilidade 50/50. O comprador é Guilherme, o titular do cartão é Wallace e a responsabilidade é R$ 2.000 para cada um. O fato de o cartão ser de Wallace não transforma automaticamente R$ 4.000 em responsabilidade de Wallace.

## Uma história, várias representações

Compra, parcela, fatura, limite usado, pagamento de fatura, funding e acerto podem representar consequências diferentes do mesmo acontecimento. Eles não são novas despesas por serem objetos diferentes no sistema.

Uma compra de R$ 6.000 em 12x é uma despesa econômica de R$ 6.000 e doze compromissos financeiros de R$ 500. O pagamento de cada fatura movimenta caixa e realiza funding; não cria novamente a despesa.

## Entradas e neutralidade econômica

Renda verdadeira pode incluir salário, aluguel, freelance, bônus, presente e rendimento. Não são renda comum: transferência entre recursos próprios, empréstimo tomado, recebimento de recebível, acerto entre membros, refund e resgate de principal.

Da mesma forma, emprestar dinheiro não cria automaticamente despesa para quem empresta nem renda para quem recebe: pode criar caixa + recebível/pagável.

## Previsto, realizado e projeção

O Casa distingue saldo realizado de compromissos e projeção. Limite de cartão, LIS disponível, benefício, reserva, investimento e recebível não podem ser apresentados como dinheiro transacional disponível.

Previsão vencida não se realiza pela passagem do tempo. Ela precisa ser resolvida ou permanecer como pendência.

## Acertos

A posição entre membros forma uma conta-corrente contínua, sem reset mensal. Ela nasce da diferença entre responsabilidade econômica, funding realizado/projetado e transferências explicitamente consideradas nessa posição.

O pagamento da fatura não cria uma segunda posição. Transferência entre contas de membros diferentes pode alterar a posição quando o usuário a considera parte da relação entre eles; essa escolha pode vir marcada por padrão na UX e deve permitir exceção. Quando considerada, a transferência pode atravessar zero e inverter a posição líquida, preservando um único movimento de caixa e histórico auditável.

## Terceiros

Quando um terceiro participa economicamente de uma compra, sua parcela não aumenta a despesa econômica da Casa. Pode surgir um recebível. Quando o terceiro paga esse recebível, caixa aumenta e o recebível diminui, mas renda continua zero.

Quando um terceiro paga uma despesa da Casa, deve existir decisão explícita entre presente e reembolso. O Casa não presume obrigação sem informação suficiente.

## Refund, cancelamento e correção

- **Cancelamento** preserva o fato histórico e remove seus efeitos futuros conforme as regras do motor.
- **Refund** reduz/reverte economicamente uma compra e nunca é renda comum; pode ser integral ou parcial e mantém vínculo com a origem.
- **Correção** de fato que já produziu dependências deve preservar histórico e recalcular somente o que puder ser recalculado com segurança e atomicidade.

## Regra de validação de novas funcionalidades

Antes de implementar ou aprovar uma PR financeira, responder:

> Esta ação está criando um fato econômico novo ou apenas mudando como um fato existente foi financiado, pago, dividido, liquidado, corrigido ou apresentado?

Se for consequência de um fato existente, ela não pode virar nova despesa ou renda por acidente.

## Checklist obrigatório de PR

Toda PR que altere comportamento financeiro deve ser auditada contra estas perguntas:

- Qual dos 6 motores ela altera?
- Ela cria fato econômico novo? Se sim, qual?
- Pode duplicar despesa ou renda já reconhecida?
- Preserva comprador ≠ titular ≠ responsável ≠ funder?
- Preserva previsto ≠ realizado?
- Preserva data econômica ≠ mês financeiro ≠ caixa?
- Preserva vínculo e histórico do fato original?
- Introduz alguma inferência silenciosa de responsabilidade, funding, refund ou liquidação?
- Falha de leitura pode aparecer como R$ 0,00 ou outro dado aparentemente válido?
- Mantém isolamento por Casa/RLS e operações atômicas quando necessário?

Uma resposta insegura é bloqueante até que a semântica seja esclarecida.

## Estado de implementação após a PR #49

Este bloco é informativo e pode evoluir; os mandamentos acima não dependem dele.

Já materializados na experiência ou no motor: autenticação/Supabase e RLS por Casa; contas, cartões e categorias; transações; responsabilidade econômica e funding; compromissos; projeções; saúde financeira; acertos canônicos entre membros; terceiros/liabilities; edição/cancelamento/refund direto auditáveis; histórico visual de ajustes; Home canônica; perspectivas Nossa Casa/Wallace/Guilherme; navegação Casa/Gastos/Entradas/Ajustes.

Fronteiras que exigem cuidado especial nas próximas etapas: refund parcial; refund complexo em cartão/parcelamento; alteração auditável de comprador/responsabilidade após dependências; correções de recorrência/série; expansão da UX de acertos, terceiros e demais fluxos neutros sem reconstruir regras financeiras no frontend.

## Regra final

O Casa deve conseguir explicar não apenas **quanto**, mas **por quê**: o que aconteceu, de quem é a responsabilidade, de onde saiu ou sairá o recurso, quando isso afeta planejamento e caixa, quem deve quem e qual história levou à posição atual.
