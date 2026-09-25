# Decisão — Roteador Financeiro e ações por recurso

**Data:** 2026-09-25  
**Status:** parcialmente DEFINIDO / parcialmente PROPOSTO

## Problema

O motor financeiro do Casa Finance já representa de forma robusta eventos econômicos, caixa, funding, titularidade, acertos, obrigações, faturas e patrimônio. A interface não deve exigir que o usuário conheça ou selecione essas estruturas técnicas.

## Princípio DEFINIDO

O usuário informa o acontecimento real, as pessoas e os recursos envolvidos. O Casa deriva o comando financeiro canônico adequado.

A UX usa linguagem cotidiana; a complexidade permanece no motor.

## Regras DEFINIDAS

1. Entrada de renda preserva beneficiário e conta de destino como conceitos distintos.
2. Depois de escolher o beneficiário, a UX prioriza contas das quais ele é titular; conta conjunta pode aparecer para ambos.
3. Renda destinada a uma conta conjunta continua pertencendo economicamente ao beneficiário escolhido.
4. Conta conjunta é 50/50 para liquidez individual e para funding realizado de saídas feitas por ela; responsabilidade econômica permanece independente.
5. Transferência entre recursos exclusivos de membros diferentes reduz primeiro acerto realizado já existente no mesmo sentido.
6. Excedente da transferência exige intenção explícita: permanecer a favor do remetente ou ser transferência definitiva sem devolução. Não vira renda/despesa automaticamente.
7. Investimento e reserva usam aporte/resgate de principal como movimentos patrimoniais neutros.
8. Poupança é recurso transacional: pode pagar, transferir e também receber movimentos apresentados como aporte/resgate.
9. Benefício é recurso restrito; carga não é renda.
10. Pagamento de fatura sai de conta escolhida, realiza funding e liquida a fatura sem criar nova despesa.

## UX PROPOSTA

Na Home/Casa, cada recurso exibido em “Onde está nosso dinheiro” passa a ser clicável e abre um detalhe contextual. O conjunto de ações depende da natureza do recurso:

- conta/carteira/poupança: pagar ou transferir; poupança também pode usar linguagem de aporte/resgate;
- dinheiro físico: depositar/transferir para outro recurso e aportar;
- benefício: consultar saldo e registrar uso compatível;
- reserva/investimento: aportar ou resgatar;
- cartão: abrir fatura/detalhe e pagar fatura a partir de uma conta.

O usuário não escolhe entre “transfer”, “settlement”, “funding” ou “invoice payment”. O Casa decide o comando interno a partir do contexto.

## Proteções

- nenhuma movimentação de caixa vira renda/despesa automaticamente;
- não criar dívida inversa silenciosa por excedente de transferência;
- não inferir responsabilidade econômica a partir de titularidade;
- não recriar fórmulas financeiras no frontend;
- operações compostas permanecem atômicas, auditáveis e idempotentes;
- reutilizar os RPCs/comandos canônicos existentes.

## Implementação

**PENDENTE:** desenhar e homologar a experiência de detalhe/ações por recurso antes de alterar a Home. A proposta deve reutilizar a infraestrutura atual e não substituir o motor existente.
