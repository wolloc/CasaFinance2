# Modelo definitivo Supabase: migração e rollback

## Objetivo e decisões

A migração `202609030001_finance_ledger.sql` cria o ledger canônico sem ligar a interface ao Supabase. Ela é aditiva, usa UUID, `TIMESTAMPTZ` e `NUMERIC(19,2)`, não contém seed nem identificadores fixos e pode ser reaplicada. Cadastros referenciados são desativados por `deactivated_at`; fatos financeiros usam cancelamento/estorno e não são apagados fisicamente.

Os quatro papéis financeiros são deliberadamente independentes:

1. `buyer_member_id` registra quem originou a compra;
2. `transaction_payment_instruments` registra conta/carteira/VA ou cartão usado;
3. `funding_events` registra quem efetivamente forneceu caixa e de qual conta;
4. `transaction_splits` registra a responsabilidade econômica e deve totalizar 100% e o valor da transação.

Uma compra no cartão aponta para `card_invoices`, reconhece a despesa na `competence_date` e não cria saída bancária. A saída ocorre por uma transação `invoice_payment`, ligada à fatura e à conta de origem por `card_invoice_payments`. Nesse momento, eventos de financiamento podem associar o pagamento aos itens da fatura. Transferências têm origem e destino explícitos e não compõem receita/despesa.

`transaction_date`, `competence_date`, `due_date` e `settled_at` têm significados distintos. Estados planejados ou pendentes alimentam projeção; somente `paid`/`received`, acompanhados de `settled_at`, alimentam o realizado.

## Compatibilidade com o legado

O legado usa `payer_user_id` com sentidos sobrepostos. Ele **não é** alterado nem reutilizado por esta migração: continua significando apenas “usuário indicado como pagador pelo registro legado”. O substituto é `transaction_payment_instruments` para a rota financeira e `funding_events.funder_member_id` para o financiador efetivo. A responsabilidade permanece exclusivamente em `transaction_splits`.

Plano de retirada posterior:

1. criar perfis/membros para usuários existentes;
2. classificar cada `payment_method_id`, `account_id` e `card_id` no instrumento explícito;
3. criar eventos de financiamento somente para saídas liquidadas (pagamento de cartão incluído);
4. reconciliar splits e saldos em modo somente leitura;
5. trocar consumidores para os campos novos;
6. remover `payer_user_id` apenas em outra migração, depois de telemetria e aceite contábil.

## Aplicação

1. Fazer backup e testar em um projeto Supabase de staging restaurado da produção.
2. Executar `supabase db lint` e revisar conflitos com objetos legados.
3. Aplicar com `supabase migration up` em uma janela controlada.
4. Rodar a migração de dados legados em lote separado e transacional; esta PR não inventa relações ambíguas.
5. Validar totais de fatura, saldos realizados, projeções e acerto do casal antes de liberar escrita.

## Rollback seguro

Não se recomenda apagar tabelas após escrita. Para rollback operacional, interrompa os novos writers, volte a aplicação para a versão anterior e preserve os objetos novos: eles são aditivos e não mudam a semântica dos campos legados.

Em staging, ou se for comprovado que nenhum dado foi gravado, remova na ordem inversa: triggers/funções, índices, tabelas filhas (`funding_events`, splits, instrumentos, pagamentos, parcelas e ocorrências), tabelas pais e por fim enums. Nunca execute `DROP ... CASCADE` em produção. Um rollback destrutivo não é fornecido de propósito, pois poderia apagar lançamentos financeiros e quebrar referências externas.

## Riscos e limitações

- Relações entre households precisam ser validadas pela camada de serviço; FKs simples garantem existência, mas não que duas entidades pertençam ao mesmo household.
- Totais de split são validados por trigger diferida ao final da transação. Writers devem inserir a transação e todos os splits na mesma transação SQL.
- Totais e liquidação de faturas devem ser atualizados por serviço/RPC transacional numa etapa posterior.
- RLS e políticas de escrita serão entregues com a integração de autenticação; até lá, esta migração não deve ser exposta diretamente ao cliente.
- `Money` e `Percentage` são strings no limite de persistência TypeScript para evitar perda de precisão de `NUMERIC`; conversão e arredondamento pertencem à camada de domínio.
