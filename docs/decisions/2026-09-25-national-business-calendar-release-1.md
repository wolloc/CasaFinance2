# Decisão — calendário nacional de dias úteis da Release 1

**Status:** DEFINIDO e IMPLEMENTADO  
**Data:** 2026-09-25  
**Escopo:** Brasil, feriados nacionais, cobertura até 2030.

## Decisão

O Casa Finance passa a manter uma referência legal e versionada dos feriados nacionais brasileiros de 2000 a 2030.

Para a operação futura da Release 1, a regra de dia não útil é:

- compromisso/despesa recorrente em conta: mover a data **prevista de liquidação** para o próximo dia útil;
- entrada recorrente: antecipar a data **prevista de recebimento** para o dia útil anterior;
- sábado, domingo e os feriados nacionais carregados são dias não úteis.

A data econômica e a âncora da recorrência não mudam. O ajuste é apenas da data projetada de impacto e não cria fato econômico, movimento de caixa, funding, fatura ou liquidação.

## Fonte e conjunto importado

A referência usa:

- Lei nº 662/1949, com redação da Lei nº 10.607/2002;
- Lei nº 6.802/1980;
- Lei nº 14.759/2023.

São carregados: Confraternização Universal, Tiradentes, Dia Mundial do Trabalho, Independência do Brasil, Nossa Senhora Aparecida, Finados, Proclamação da República, Dia Nacional de Zumbi e da Consciência Negra e Natal. Os recortes históricos respeitam a vigência legal: Finados é carregado a partir de 2003 e Consciência Negra a partir de 2024.

Feriados estaduais, municipais, religiosos municipais e pontos facultativos não são inferidos nesta versão. Isso evita apresentar como regra nacional algo que depende de localidade ou de ato anual.

## Limites e segurança

A consulta para data fora de 2000–2030 falha de forma explícita. A cobertura deve ser ampliada por migration forward-only antes de qualquer projeção além de 2030; o produto não pode aplicar um calendário incompleto silenciosamente.

A tabela de referência é somente leitura para usuários autenticados. Não contém nem cria dados financeiros de uma Casa.

## Cartões

Esta decisão não define qual fatura recebe uma compra realizada no dia de fechamento. Essa regra permanece pendente por emissor na issue #272. A geração de recorrência no cartão continua usando o ciclo canônico da fatura, sem alteração neste PR.
