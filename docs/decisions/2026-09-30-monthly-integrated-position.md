# Casa — extrato mensal e posição integrada

Data: 2026-09-30

## DEFINIDO — objetivo
A Home da Casa deve responder de forma direta:

> Com os recursos disponíveis, as entradas confiáveis e os compromissos conhecidos, o mês está coberto?

## DEFINIDO — Extrato do mês
Dentro de **Como estamos?**, a Casa mostra um extrato mensal integrado com:
- saldo de abertura do mês;
- entradas já realizadas;
- entradas confiáveis ainda esperadas;
- saídas/compromissos já realizados;
- compromissos que ainda devem sair;
- posição projetada para o fim do mês.

O extrato usa o **saldo de abertura** como base da equação mensal. O saldo atual não é somado novamente às entradas e saídas realizadas, evitando dupla contagem.

## DEFINIDO — cobertura do mês
A leitura de cobertura é separada do extrato e usa a orientação canônica de liquidez:
- **coberto** — o disponível atual cobre os compromissos conhecidos;
- **coberto pelas entradas esperadas** — o caixa atual sozinho não basta, mas entradas confiáveis fecham o mês;
- **precisa realocar recurso** — caixa + entradas ainda não bastam, mas reserva/investimento pode complementar;
- **precisa de plano de funding** — permanece uma lacuna de cobertura.

## DEFINIDO — patrimônio não vira caixa automaticamente
Reserva e investimento não são somados silenciosamente ao dinheiro disponível. Eles aparecem como segunda camada possível de cobertura porque exigem decisão/ação de resgate ou realocação.

## IMPLEMENTADO nesta entrega
- componente compartilhado de extrato mensal;
- posição integrada da Casa;
- mesma gramática na perspectiva individual, usando projeção canônica do membro;
- nenhuma migration e nenhuma nova regra de reconhecimento financeiro.
