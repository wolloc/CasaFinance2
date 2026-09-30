# Homologação — listas compactas e destaque entre moradores

Data: 2026-09-30

## DEFINIDO — Entradas e Gastos
- Manter ordenação do lançamento mais recente para o mais antigo.
- Remover linha e bolinha de timeline de Entradas e Gastos.
- A timeline visual permanece somente na fatura.
- Reduzir altura, padding e espaçamentos dos cards sem remover informação financeira necessária.
- Gastos não usam borda laranja para sinalizar compromisso futuro.
- Gastos não exibem os textos “Gasto recorrente” e “Ainda compromete R$ ...”.
- Quando o meio/recurso for cartão, a tag do cartão recebe destaque discreto próprio.
- Entradas futuras continuam diferenciadas por cor/status já existentes.

## DEFINIDO — transferência contextual
- Remover a explicação longa sobre impacto automático na posição entre moradores.
- Manter o controle “Considerar na posição entre vocês” e sua regra financeira.
- Remover a mensagem que explica que o usuário veio de um recurso específico e que ele foi pré-selecionado.
- O próprio pré-preenchimento deve comunicar o contexto.

## DEFINIDO — Como estamos
- “Entre moradores” ganha um subbloco próprio e visualmente mais destacado dentro de “Como estamos”.
- Mostrar de forma clara quem deve para quem e o valor.
- O detalhamento histórico continua em “Valores com pessoas”.

## Guardrails
- Nenhuma alteração de regra financeira ou motor canônico.
- Compra já associada a cartão/fatura continua sendo compromisso real do cartão.
- Projeção futura de despesa não deve ganhar semântica de compra realizada apenas por causa do tratamento visual.
