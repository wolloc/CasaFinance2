# Evidências de staging — Casa Finance

Este arquivo é o contrato de evidência para liberar um beta. Ele não substitui a CI: registra o que só pode ser provado em um ambiente Supabase de staging separado e nos dispositivos reais de Wallace e Guilherme.

## Identificação da rodada

Preencher em cada homologação:

- commit/release candidato: `020b02bc5753f6de353a5c6b4661db0c368b5f41`
- data e hora: 2026-09-21 — smoke automatizado concluído com sucesso
- projeto Supabase de staging: `Casa Finance Staging` (projeto separado confirmado)
- responsável pela execução: GitHub Actions / workflow `Staging smoke`
- iPhone Wallace / versão iOS:
- iPhone Guilherme / versão iOS:

Nunca registrar senhas, JWTs, service-role keys, publishable keys privadas de ambiente ou dumps com dados pessoais neste arquivo.

## Gate A — ambiente e migrations

- [x] staging é um projeto separado do projeto principal — confirmado via Supabase em 2026-09-21;
- [x] migrations versionadas do staging conferidas até `20260921020630_security_advisor_search_path_hardening`; a CI reaplica a cadeia desde zero;
- [x] versão/commit testado é exatamente o candidato ao beta (`020b02bc5753f6de353a5c6b4661db0c368b5f41`);
- [ ] nenhum dado real de produção foi necessário para a homologação — confirmar na rodada humana.

Evidência/observação:

- `Casa Finance Staging`: `ACTIVE_HEALTHY`, separado de `Casa Finance`.
- `Staging smoke` da `main`: **SUCCESS** em 2026-09-21 para o SHA acima.
- CI da `main`: **SUCCESS** para o mesmo SHA.
- O smoke automatizado não substitui os itens explicitamente marcados para confirmação humana.

## Preparação da rodada humana

Executar a homologação sem Supabase, Codespaces ou GitHub abertos durante os fluxos funcionais. Wallace entra primeiro e confirma a Casa; Guilherme entra com credencial própria e aceita o vínculo; ambos fazem logout/login; Wallace executa o ciclo crítico e Guilherme confere; depois Guilherme registra pelo menos um gasto e Wallace confere; por fim, os dois validam o uso mobile. Se algo falhar, registrar o primeiro ponto de quebra sem corrigir manualmente o banco.

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

## Gate D — recuperação

- [x] reconstrução estrutural em Supabase local isolado — a CI inicia banco vazio e reaplica migrations;
- [x] gates financeiros/RLS/Auth executados sobre o ambiente descartável reconstruído;
- [ ] gerar backup verificável dos dados do staging;
- [ ] restaurar os dados em ambiente isolado;
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
