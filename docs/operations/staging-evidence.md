# Evidências de staging — Casa Finance

Este arquivo é o contrato de evidência para liberar um beta. Ele não substitui a CI: registra o que só pode ser provado em um ambiente Supabase de staging separado e nos dispositivos reais de Wallace e Guilherme.

## Identificação da rodada

Preencher em cada homologação:

- commit/release candidato:
- data e hora:
- projeto Supabase de staging (somente o identificador não secreto):
- responsável pela execução:
- iPhone Wallace / versão iOS:
- iPhone Guilherme / versão iOS:

Nunca registrar senhas, JWTs, service-role keys, publishable keys privadas de ambiente ou dumps com dados pessoais neste arquivo.

## Gate A — ambiente e migrations

- [ ] staging é um projeto separado de produção;
- [ ] migrations versionadas foram aplicadas sem edição manual no banco;
- [ ] versão/commit testado é exatamente o candidato ao beta;
- [ ] nenhum dado real de produção foi necessário para a homologação.

Evidência/observação:

## Gate B — Casa compartilhada e autenticação

- [ ] Wallace entra com credencial própria;
- [ ] Guilherme entra com credencial própria;
- [ ] convite/aceite coloca ambos na mesma Casa;
- [ ] logout e novo login preservam a Casa e os dados;
- [ ] pessoa externa não enxerga nem altera a Casa compartilhada.

Evidência/observação:

## Gate C — ciclo financeiro crítico

- [ ] cadastrar conta e cartão;
- [ ] registrar receita recebida;
- [ ] registrar despesa direta compartilhada mantendo comprador, responsabilidade econômica, titularidade e pagador independentes;
- [ ] transferir entre contas sem alterar resultado econômico;
- [ ] registrar compra parcelada no cartão sem movimento bancário imediato;
- [ ] pagar fatura sem duplicar despesa;
- [ ] reconhecer juros/tarifas/multa de empréstimo sem caixa e liquidar depois com um único movimento de caixa;
- [ ] validar aporte/resgate sem tratar transferência patrimonial como receita/despesa;
- [ ] conferir acerto realizado e projetado do casal.

Evidência/observação:

## Gate D — backup e restauração

- [ ] gerar backup verificável do staging;
- [ ] restaurar em ambiente isolado;
- [ ] comparar contagens das tabelas financeiras relevantes;
- [ ] reconciliar saldos, faturas, obrigações e posições de acerto antes/depois;
- [ ] executar novamente os gates de RLS/Auth/financeiro contra a restauração;
- [ ] registrar duração do restore e qualquer intervenção manual.

Evidência/observação:

## Gate E — uso real no iPhone

- [ ] Wallace conclui o roteiro sem Supabase/Codespaces;
- [ ] Guilherme conclui o roteiro sem Supabase/Codespaces;
- [ ] navegação, formulários e teclado funcionam em tela móvel;
- [ ] falha de rede não deixa dados antigos disponíveis para uma nova mutação;
- [ ] erros relevantes são compreensíveis para quem não conhece a implementação.

Evidência/observação:

## Decisão

- [ ] APROVADO PARA BETA PRIVADO
- [ ] REPROVADO — há bloqueadores abaixo

Bloqueadores:

1. 

Aprovação Wallace:

Aprovação Guilherme:
