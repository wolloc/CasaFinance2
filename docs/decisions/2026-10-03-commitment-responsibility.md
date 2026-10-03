# Homologação — compromisso do gasto e recursos da Casa

## DEFINIDO
- **Responsabilidade do compromisso** é independente de comprador e de quem efetivamente pagou.
- Editar responsabilidade não altera comprador, meio de pagamento ou funding histórico.
- Para uma compra parcelada, a responsabilidade econômica pertence à compra e é refletida nas parcelas/compromissos derivados.
- A Home deve manter uma leitura simples de **Como estamos?**, mas continuar permitindo visualizar rapidamente Caixa, Benefícios e Investimentos.
- **Onde está nosso dinheiro?** possui um único título; o mapa não repete o cabeçalho.

## IMPLEMENTADO
- Correção do erro SQL da edição de responsabilidade (42702 — referência ambígua em economic_allocations).
- RPC passa a atualizar somente updated_at; comprador permanece inalterado.
- Chave de idempotência da correção não depende do comprador.
- Editor visual reduzido para a decisão de responsabilidade.
- Home mostra três referências compactas de recursos: Caixa, Benefícios e Investimentos.
- Removido cabeçalho duplicado de Onde está nosso dinheiro.

## PENDENTE
- Homologação do fluxo pelo PM com uma compra parcelada existente, incluindo troca para Guilherme e divisão 50/50.
