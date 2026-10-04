# Estabilização das jornadas financeiras — 2026-10-04

## Status
**EM HOMOLOGAÇÃO**

Esta mudança consolida as correções recentes em torno de faturas e responsabilidade e estabelece uma estratégia de leitura resiliente.

## Faturas — princípio
A fatura aberta na interface deve sempre ser obtida dinamicamente do Supabase.

Fonte primária:
- `financial_card_journey_positions`

Fallback seguro:
- `financial_card_invoice_positions`

O fallback não cria, estima ou presume valores. Ele usa somente a posição financeira materializada da fatura e identifica o cartão diretamente.

A consulta da fatura selecionada usa:
- `household_id`
- `invoice_id`

Ações de leitura não alteram saldo, limite, pagamento ou histórico.

## Responsabilidade
A responsabilidade econômica pode ser:
- 100% de um morador;
- 100% de um terceiro;
- divisão entre os moradores;
- divisão personalizada entre até três participantes, combinando moradores e terceiros.

Comprador e pagador histórico permanecem independentes da responsabilidade.

A validação final continua no banco, com:
- participantes ativos;
- participante único por item;
- 1 a 3 participantes;
- percentuais positivos;
- total de 100%;
- mesma household;
- idempotência da correção.

## Segurança e sustentabilidade
- O frontend não é a autoridade financeira.
- O banco valida a operação.
- Falhas de leitura não devem gerar valores fictícios.
- Erros internos do banco não são expostos diretamente ao usuário.
- Refresh ocorre somente depois de uma operação concluída.
- Leituras são dinâmicas e escopadas pela household/cartão/fatura.

## Critério de aceite
Antes de considerar esta frente estável:
1. abrir fatura atual;
2. navegar para anterior/próxima;
3. abrir fatura sem lançamentos;
4. abrir fatura com parcelas;
5. responsabilidade 100% morador;
6. responsabilidade 100% terceiro;
7. divisão morador + terceiro;
8. três participantes;
9. tentativa de percentual diferente de 100%;
10. repetir uma operação após falha de rede sem duplicação.
