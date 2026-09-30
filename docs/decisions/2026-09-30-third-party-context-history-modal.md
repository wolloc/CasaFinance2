# Histórico contextual com terceiros em “Valores com pessoas”

Data: 2026-09-30

## DEFINIDO — interação
- Tocar no card de um terceiro em **Valores com pessoas** abre um modal centralizado.
- O card deixa de ser usado como expansão inline para o detalhamento principal.
- O modal possui fechamento por **X** e por toque fora do conteúdo, seguindo o padrão já definido para modais do Casa.

## DEFINIDO — conteúdo
O modal contextual mostra:
- a pessoa;
- a posição atual da relação;
- obrigações ainda em aberto;
- ação contextual de pagamento ou recebimento;
- acesso ao detalhe de empréstimo quando aplicável;
- um **extrato da relação** em ordem cronológica, incluindo a origem dos valores e eventos posteriores.

## DEFINIDO — semântica financeira
- O extrato é leitura do histórico canônico em `financial_obligations` e `obligation_events`.
- Pagamento e recebimento são liquidações e não criam nova despesa ou receita.
- Perda, perdão, cancelamento e correção permanecem eventos auditáveis.
- Obrigações encerradas continuam visíveis no histórico; o saldo destacado do card/modal representa somente o que permanece em aberto.
- Nenhum novo motor financeiro, tabela ou migration é criado para esta experiência.

## IMPLEMENTADO nesta entrega
- leitura contextual por terceiro;
- modal centralizado;
- extrato auditável;
- ações existentes reaproveitadas no contexto da obrigação.
