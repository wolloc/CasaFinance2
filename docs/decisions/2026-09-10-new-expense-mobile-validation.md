# Validação mobile da Nova Despesa — 2026-09-10

## DEFINIDO

- A Nova Despesa deve priorizar o fato financeiro e reduzir textos explicativos de bastidor.
- O cabeçalho do modal fica apenas com **Nova despesa**; remover títulos auxiliares como “O que aconteceu?” e “Etapa 1 de 2”.
- O texto explicativo de “Quem fez esse gasto?” não deve aparecer na jornada normal.
- A data do gasto continua limitada a hoje ou passado. A interface deve impedir/clamp qualquer tentativa de manter data futura antes do envio, além da validação de domínio já existente.
- O campo **Quanto?** deve ter maior destaque visual e normalizar valores monetários para duas casas decimais.
- Textos técnicos do motor financeiro e textos de roadmap não devem aparecer na experiência final da Nova Despesa.

## PENDENTE / PRÓXIMAS ENTREGAS

- Terceiro como responsável econômico em **Quem assume esse gasto?**, reutilizando `financial_parties` e preservando a separação entre responsável econômico e pagador.
- Divisão personalizada.
- Recorrência ao final da Nova Despesa.

## BUGS OBSERVADOS NO PREVIEW

- Compra parcelada em cartão de crédito retornou erro ao registrar.
- Dashboard apresentou erro ao carregar.
- A tela Gastos apresenta o mesmo fato financeiro em dois blocos, criando duplicação visual/confusão. O redesenho deve seguir as lentes já definidas de **Gastos realizados** e **Compromissos do mês**, sem duplicar o fato econômico.

## Nota de diagnóstico

A UI anterior descartava detalhes de erros que chegam do Supabase como objetos que não são instâncias de `Error`. O wizard passa a extrair a propriedade `message` quando disponível para que o próximo teste revele a causa real do erro de cartão, sem alterar a regra financeira por tentativa e erro.
