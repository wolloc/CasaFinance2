# Auditoria pós-Acertos — 2026-09-27

**Objetivo:** garantir que nenhuma funcionalidade construída no antigo hub de Acertos tenha sido perdida ao simplificar a navegação.

## Resultado executivo

A remoção do botão/hub genérico de Acertos simplificou a experiência, mas nem todas as operações antigas já possuem um endereço cotidiano explícito.

### IMPLEMENTADO — já encontrou um endereço natural

| Funcionalidade antiga | Novo endereço | Situação |
| --- | --- | --- |
| Transferir dinheiro entre contas | Casa → Contas e recursos → recurso → **Transferir deste recurso** | IMPLEMENTADO |
| Transferência entre contas de membros diferentes | Mesmo fluxo de transferência, com **Considerar na posição entre vocês** por padrão quando aplicável | IMPLEMENTADO |
| Posição financeira entre membros | Casa → **Valores com pessoas** | IMPLEMENTADO |
| Criar valor com terceiro | Casa → **Valores com pessoas** → Adicionar valor com outra pessoa | IMPLEMENTADO |
| Receber/pagar terceiro | Casa → **Valores com pessoas** → ação contextual no valor | IMPLEMENTADO |
| Corrigir/cancelar valor manual com terceiro | Casa → Valores com pessoas → Outras opções do valor | IMPLEMENTADO |
| Dar baixa em recebível que não será recebido | Casa → Valores com pessoas → Outras opções do valor | IMPLEMENTADO |
| Registrar dívida perdoada | Casa → Valores com pessoas → Outras opções do valor | IMPLEMENTADO |
| Pagar fatura | Casa/Cartões/Faturas → fatura selecionada → pagamento contextual | IMPLEMENTADO |
| Aporte/resgate de reserva ou investimento | Casa → Contas e recursos → recurso patrimonial → **Aportar ou resgatar** | IMPLEMENTADO |

### PENDENTE — funcionalidade existe, mas o endereço ficou incompleto

#### Empréstimos

O motor e a jornada continuam implementados em `LoanAdjustment`:
- Emprestei dinheiro;
- Peguei emprestado;
- principal movimenta caixa sem virar gasto/renda;
- juros/tarifas/multas são tratados separadamente;
- pagamento/devolução do empréstimo possui fluxo próprio.

Problema atual:
- existe uma rota `loan-granted` preparada a partir de Gastos;
- `TransactionsScreen` ainda declara `onGrantLoan`, mas não o consome na interface atual;
- portanto, **Emprestei dinheiro não possui hoje um CTA cotidiano efetivamente acessível**;
- **Peguei emprestado também não possui um ponto de entrada cotidiano fora da antiga seleção genérica de Acertos**;
- o componente segue presente no código, mas o caminho do usuário ficou órfão.

**PROPOSTO:** mover a entrada de Empréstimos para **Casa → Valores com pessoas**, porque empréstimo representa uma relação financeira com uma contraparte — um valor a receber ou a devolver — e não uma despesa ou renda.

Não implementar automaticamente até validação de produto.

### DEPRECADO como jornada principal

O antigo seletor genérico em `NewAdjustmentScreen` ainda preserva operações internas e compatibilidade com intents contextuais, mas não deve voltar a ser exposto como um menu amplo de “Acertos”.

As ações devem continuar migrando para superfícies contextuais.

## Simplificação visual de Gastos

**DEFINIDO:** remover da lista de Gastos o helper técnico:

> Compras realizadas no mês, usando a data econômica do fato. Parceladas aparecem uma vez pelo valor econômico da compra.

A regra financeira permanece documentada e testada; não precisa ocupar espaço permanente na jornada cotidiana.

## Próxima rodada recomendada

1. Simplificar **Detalhe da entrada**.
2. Simplificar **Detalhe do gasto**.
3. Resolver o endereço definitivo de **Empréstimos**.
4. Só depois fazer a rodada de redução de densidade da **Casa/Home**.

O objetivo é manter o rigor no motor e reduzir carga cognitiva na superfície.
