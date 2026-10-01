# Responsável planejado pelo pagamento de compromissos

Data: 2026-10-01

## DEFINIDO — conceitos separados

O Casa diferencia:

1. **quem ficará responsável pelo pagamento** de um compromisso futuro;
2. **qual conta efetivamente pagará** esse compromisso quando o pagamento acontecer.

Esses conceitos não podem ser fundidos.

### Responsável planejado
Serve para a projeção individual de liquidez:
- Wallace;
- Luiz;
- Dividido.

Essa definição distribui o compromisso futuro entre os moradores sem inventar uma conta de origem.

### Conta real de pagamento
Só é definida quando a parcela/obrigação é efetivamente paga ou quando houver uma rota financeira explicitamente escolhida.

A conta real continua sendo o fato de funding/caixa.

## DEFINIDO — empréstimo tomado

Ao registrar empréstimo tomado, o fluxo deve perguntar:

**Quem ficará responsável pelo pagamento?**

Opções:
- cada morador ativo;
- Dividido.

A escolha vale para as parcelas do cronograma.

Juros e tarifas continuam com responsabilidade econômica própria e não alteram esta regra de funding planejado.

## DEFINIDO — compromissos sem responsável

A Home não usa linguagem técnica como "rota individual definida".

Quando existirem compromissos da Casa ainda sem responsável planejado, deve mostrar:
- total ainda sem responsável;
- composição por compromisso;
- descrição;
- valor;
- vencimento, quando existir;
- ação contextual quando for possível resolver.

Esses valores continuam na projeção da Casa, mas não são debitados silenciosamente de nenhum morador.

## IMPLEMENTADO — candidato de homologação

- modelo canônico obligation_member_payer_plans;
- projeção individual considera planos de pagador por morador;
- residual não atribuído continua separado;
- Home detalha os compromissos sem responsável;
- novos empréstimos perguntam responsável;
- empréstimos existentes permitem ajustar responsável no detalhe;
- nenhuma conta é inventada antecipadamente.
