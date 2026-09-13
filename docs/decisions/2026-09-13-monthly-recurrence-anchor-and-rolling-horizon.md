# Recorrência mensal preserva o dia-base e usa horizonte móvel

**Status: DEFINIDO**

## Decisão de calendário

Uma recorrência mensal tenta sempre manter o dia definido pela primeira ocorrência da regra.

Quando esse dia não existe em determinado mês, a ocorrência usa o último dia disponível daquele mês. No mês seguinte, o Casa volta a tentar o dia-base original; a exceção de um mês curto não desloca definitivamente a série.

Exemplo para uma regra mensal no dia 31:

- 31/01;
- 28/02 (ou 29/02 em ano bissexto);
- 31/03;
- 30/04;
- 31/05.

A regra vale também quando a recorrência usa intervalo de mais de um mês: cada ocorrência continua sendo calculada a partir da data-base da regra, e não a partir da data ajustada da ocorrência anterior.

## Decisão de horizonte

As ocorrências futuras continuam sendo projeções, não despesas realizadas antecipadamente.

O Casa deve manter um **horizonte móvel mínimo de 12 meses a partir da data atual** para as recorrências ativas usadas nas projeções financeiras. Ao abrir a visão financeira principal, o horizonte é estendido antes de calcular o dashboard.

Esse comportamento evita que uma série ativa simplesmente deixe de aparecer porque o horizonte originalmente materializado chegou ao fim.

## Invariantes preservados

- materializar novas ocorrências futuras não cria caixa nem funding realizado;
- uma ocorrência futura nasce como projeção;
- estender o horizonte novamente é idempotente e não duplica ocorrências;
- confirmar ou pagar uma ocorrência continua usando os fluxos dedicados já existentes;
- VA/VR/benefício continua sem suporte a recorrência, conforme decisão específica já registrada.
