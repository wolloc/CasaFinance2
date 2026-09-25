# Decisão — Recorrência mensal de despesas na Release 1

**Data:** 2026-09-25  
**Status:** DEFINIDO — implementação em andamento nesta PR

## Contexto

A recorrência de despesa foi criada para compromissos cotidianos que normalmente se repetem mensalmente, como aluguel, streaming, condomínio e contas de consumo. A exposição de frequência semanal/anual e intervalos arbitrários aumentava a complexidade da UX e ampliava desnecessariamente o custo de materialização das projeções.

## Decisão

Na Release 1, uma **recorrência de despesa**:

1. repete **uma vez por mês**;
2. usa `frequency='monthly'` e `interval_count=1`;
3. preserva o dia-base econômico da série;
4. em mês sem o dia-base, usa o último dia válido daquele mês e volta à âncora original nos meses seguintes;
5. pode ter uma data da primeira repetição e uma data final opcional;
6. quando configurada para 12 meses, gera exatamente 12 ocorrências mensais contando a primeira repetição;
7. continua sendo projeção até a ocorrência ser confirmada/realizada;
8. não é parcelamento.

Semanal, quinzenal, anual e intervalos customizados de **despesas** ficam fora da Release 1.

## Dias úteis

Para recorrência paga diretamente por conta:

- a data econômica/âncora permanece intacta;
- se a data cair em fim de semana ou feriado nacional brasileiro coberto pelo calendário do Casa, somente a data financeira projetada é deslocada para o próximo dia útil.

Para cartão, a ocorrência mensal continua usando o cálculo canônico de ciclo/fatura. A decisão separada sobre compra exatamente no dia do fechamento permanece pendente em #272.

## Compatibilidade

- novas séries de despesa e revisões futuras devem obedecer ao contrato mensal;
- séries históricas não mensais, caso existam, não são reescritas ou apagadas;
- uma série histórica pode ser encerrada; se for revisada, a nova versão passa ao contrato mensal da Release 1;
- recorrências de **entrada** mantêm contrato próprio e não são alteradas por esta decisão.

## Performance e integridade

A simplificação de produto não justifica elevar `statement_timeout`.

A implementação reduz reconciliações intermediárias durante a montagem de uma ocorrência projetada:

- a reconciliação entre membros aguarda a responsabilidade econômica fechar 100% e o valor canônico;
- rescalas que não alteram centavos não executam updates redundantes;
- quando a ocorrência fica consistente, o ledger canônico de acertos é reconciliado;
- nenhuma projeção cria caixa ou funding realizado.

## UX

A Nova Despesa não pergunta frequência nem intervalo.

Ao escolher **Repetir este gasto**, a pessoa vê somente:

- primeira repetição;
- até quando (opcional).

O Casa explica que a repetição é mensal e preserva o mesmo dia-base.