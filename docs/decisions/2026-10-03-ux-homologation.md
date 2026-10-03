# Homologação UX — 2026-10-03

## IMPLEMENTADO nesta rodada

### 1. Ações de criação
- Removido o controle flutuante de Gasto/Entrada.
- **Gastos** passa a ter a ação **Gasto** ao lado do título.
- **Entradas** passa a ter a ação **Entrada** ao lado do título.
- A criação continua usando os mesmos fluxos existentes.

### 2. Parcelamento de cartão
- A lista deixa de exibir o mesmo identificador de parcela em dois lugares.
- Para compromissos mensais, a parcela é identificada pelo próprio source_installment_id.
- O lançamento original representa a parcela **1/N**; os compromissos seguintes exibem **2/N, 3/N...** conforme o mês.
- A posição da parcela não é mais inferida sobrescrevendo todas as parcelas pelo último registro do plano.

### 3. Responsabilidade do compromisso
- A correção deixa de pedir comprador, motivo e outras informações que não pertencem à decisão.
- A jornada responde somente: **quem fica com este compromisso?**
- Permite:
  - Wallace 100%;
  - Guilherme 100%;
  - divisão entre os moradores, com percentual personalizado.
- Comprador e pagamento/funding histórico continuam preservados.
- O motor canônico correct_expense_roles continua sendo a fonte da alteração.

### 4. Home — narrativa financeira
- **Como estamos?** deixa de repetir recursos, benefícios e investimentos que já aparecem no mapa financeiro.
- A leitura principal passa a ser:
  - como estamos;
  - quanto pode sobrar;
  - quanto ainda entra;
  - quanto ainda sai.
- Removida a expansão **Entender essa previsão**, que repetia os mesmos números.
- **Olhando pra frente** passa a mostrar apenas a trajetória dos próximos meses e a variação em relação ao mês anterior, sem repetir o fluxo do mês atual.

## DEFINIDO / guardrails
- Saldo, projeções, responsabilidades, funding e demais regras financeiras existentes não foram alterados conceitualmente.
- Alteração de responsabilidade não altera quem comprou nem reescreve o caixa histórico.

## PENDENTE de homologação
- Validar visualmente em produção:
  1. ação Gasto ao lado do título;
  2. ação Entrada ao lado do título;
  3. parcelas 1/3, 2/3 e 3/3 em meses diferentes;
  4. troca Wallace ↔ Guilherme e divisão 50/50;
  5. leitura da Home sem redundâncias.
