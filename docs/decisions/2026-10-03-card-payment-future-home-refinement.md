# Refinamentos de cartões, pagamento de fatura e Home futura

Data: 2026-10-03

## DEFINIDO — cartão editável

O cadastro do cartão pode ser corrigido após a criação, sem reescrever histórico:
- limite;
- dia de fechamento;
- dia de vencimento;
- identificação do cartão.

Compras, faturas e pagamentos já registrados não são recalculados retroativamente.

## DEFINIDO — pagamento de fatura contextual

Ao pagar uma fatura:
1. a conta planejada da fatura continua sendo a sugestão inicial;
2. o usuário pode escolher outra conta;
3. se a conta escolhida tiver um único titular, o Casa pré-seleciona esse morador como quem pagou;
4. se a conta for compartilhada ou não tiver titular inequívoco, o Casa continua pedindo quem pagou;
5. a conta real e o pagador real continuam sendo fatos do pagamento, não do planejamento.

Isso mantém separados:
- conta planejada;
- conta que efetivamente saiu;
- pessoa que efetivamente pagou.

## DEFINIDO — Home em mês futuro

Ao navegar para um mês futuro, a Casa mantém a mesma arquitetura operacional da Home:
- Como estamos;
- Entre vocês;
- Onde está nosso dinheiro;
- eventos/atenções contextuais;
- Olhando pra frente.

O que muda é o período e os valores projetados. A navegação futura não deve cair em uma versão antiga ou simplificada da Home.

## IMPLEMENTADO — candidato de homologação

- fluxo de pagamento de fatura pré-seleciona o pagador quando a titularidade da conta é inequívoca;
- Home futura recebeu os blocos operacionais ausentes;
- edição de cartão já existente foi mantida e coberta por teste, incluindo limite, fechamento e vencimento.
