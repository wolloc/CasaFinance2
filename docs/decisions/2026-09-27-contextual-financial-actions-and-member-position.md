# Ações financeiras contextuais e posição entre membros — 2026-09-27

## Status

**DEFINIDO**

O Casa deixa de apresentar **Ajustes/Acerto** como uma caixa de ferramentas financeira para o uso cotidiano. Os comandos canônicos continuam no motor, mas cada operação aparece no contexto do fato, recurso ou posição que ela resolve.

## Ações globais

**DEFINIDO e IMPLEMENTADO nesta etapa:**
- Nova Despesa;
- Nova Entrada.

**DEPRECADO como ação global:**
- Novo Acerto.

Pagamento de fatura, transferência, recebimento, pagamento a terceiro, investimento, estorno, correção e demais operações não são novos fatos econômicos e não devem competir visualmente com Despesa/Entrada.

## Valores com pessoas

**DEFINIDO:** a Home usa a seção **Valores com pessoas**.

Ela reúne:
- posição realizada entre membros;
- tendência/projeção entre membros;
- valores a receber de terceiros;
- valores a pagar a terceiros.

Entre membros, a UX evita tratar a posição como uma dívida tradicional. A meta de leitura é o equilíbrio próximo de zero.

## Transferência entre membros

**DEFINIDO e IMPLEMENTADO:** quando uma transferência ocorre entre recursos de membros diferentes, o Casa pode considerá-la na posição entre eles.

- a opção deve vir marcada por padrão quando a titularidade origem/destino indicar membros diferentes;
- o usuário pode marcar a transferência como exceção, sem afetar a posição;
- quando considerada, a posição pode atravessar zero e inverter de lado;
- a Home apresenta a posição líquida, evitando mostrar duas dívidas opostas simultaneamente;
- existe um único movimento de caixa;
- nunca nasce renda ou despesa por causa dessa transferência.

Esta regra substitui a regra anterior que bloqueava inversão da posição por transferência acima do saldo pendente.

## Terceiros

**DEFINIDO e IMPLEMENTADO nesta etapa:** ações ficam no contexto de cada valor:
- receber/pagar total ou parcialmente;
- corrigir cadastro/vencimento quando o compromisso manual ainda for editável;
- registrar valor que não será recebido;
- registrar dívida perdoada;
- criar novo valor com outra pessoa a partir da própria seção.

## Entradas

**DEFINIDO e IMPLEMENTADO nesta etapa:** confirmação de recebimento sai do bloco global “Outras ações” e passa para o detalhe da entrada selecionada.

## Gastos

**DEFINIDO e IMPLEMENTADO nesta etapa:** textos técnicos explicativos que não ajudam a decisão cotidiana podem ser removidos da lista; as regras financeiras continuam preservadas no motor e nos estados visuais.
