# Validação mobile da Nova Despesa — 2026-09-10

## DEFINIDO

- A Nova Despesa deve priorizar o fato financeiro e reduzir textos explicativos de bastidor.
- O cabeçalho do modal fica apenas com **Nova despesa**; remover títulos auxiliares como “O que aconteceu?” e “Etapa 1 de 2”.
- O texto explicativo de “Quem fez esse gasto?” não deve aparecer na jornada normal.
- A data do gasto continua limitada a hoje ou passado. A interface deve impedir/clamp qualquer tentativa de manter data futura antes do envio, além da validação de domínio já existente.
- O campo **Quanto?** deve ter maior destaque visual e normalizar valores monetários para duas casas decimais.
- Textos técnicos do motor financeiro e textos de roadmap não devem aparecer na experiência final da Nova Despesa.

## ATUALIZAÇÃO — 2026-09-25

### DEFINIDO

- A recorrência permanece **opcional** e desligada por padrão na conclusão da Nova Despesa.
- A ação principal da etapa final é **Registrar despesa**; recorrência aparece como ação secundária **Repetir este gasto → Adicionar**.
- Ao ativar recorrência, o Casa sugere a primeira repetição a partir da data original e da frequência escolhida, sempre em data futura; o usuário pode ajustar a sugestão.
- A despesa atual continua sendo um único fato realizado. As próximas repetições são projeções até serem confirmadas quando acontecerem.
- Quando a natureza do pagamento/responsabilidade ainda não suporta série recorrente com segurança, a opção fica indisponível e explica o motivo, sem criar uma série parcial.
- Se a despesa for registrada e a criação da série falhar, o fluxo de recuperação preserva o ID do gasto e conclui apenas a recorrência, sem duplicar a despesa.

### IMPLEMENTADO

- Terceiro como responsável econômico em **Quem assume esse gasto?**, reutilizando `financial_parties` e mantendo responsabilidade separada do pagador.
- Divisão personalizada entre membros e terceiros.
- Recorrência opcional ao final da Nova Despesa, com recuperação idempotente em falha parcial.


## BUGS OBSERVADOS NO PREVIEW

- Compra parcelada em cartão de crédito retornou erro ao registrar.
- Dashboard apresentou erro ao carregar.
- A tela Gastos apresenta o mesmo fato financeiro em dois blocos, criando duplicação visual/confusão. O redesenho deve seguir as lentes já definidas de **Gastos realizados** e **Compromissos do mês**, sem duplicar o fato econômico.

## Nota de diagnóstico

A UI anterior descartava detalhes de erros que chegam do Supabase como objetos que não são instâncias de `Error`. O wizard passa a extrair a propriedade `message` quando disponível para que o próximo teste revele a causa real do erro de cartão, sem alterar a regra financeira por tentativa e erro.
