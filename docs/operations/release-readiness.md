# Homologação, backup e recuperação

## Promoção de ambientes

Cada ambiente deve usar projeto Supabase e credenciais próprios. `development` pode rodar localmente; `staging` recebe migrations e o artefato aprovado pela CI; `production` só recebe o mesmo artefato após homologação de Wallace e Guilherme e evidência de backup/restore.

## O que a CI já prova

O Marco 3 elevou significativamente o gate automático. Hoje a CI executa, em runner descartável:

- replay de todas as migrations desde banco vazio;
- pgTAP dinâmico de RLS;
- Auth real, JWT e PostgREST;
- convite/aceite e Casa compartilhada;
- relogin/continuidade de sessão;
- despesa direta real pela API do Supabase;
- comprador, responsabilidade econômica e funder independentes;
- um único movimento de caixa para a liquidação direta testada;
- isolamento financeiro de uma pessoa externa em outra Casa;
- TypeScript, testes, Playwright, scan de segredos, `npm audit` e build;
- contrato de configuração pública de release;
- manifesto de proveniência com SHA do commit, origem Supabase e SHA-256 dos arquivos do build;
- retenção temporária do artefato exato aprovado pela CI.

Essas evidências eliminam os antigos bloqueadores que diziam que RLS era apenas estática, que não havia JWT real, que o app principal dependia de Maps/identidade simulada ou que o runtime padrão ainda precisava do Express legado.

O caminho padrão do app é Vite + Supabase. O `server/` histórico permanece apenas atrás de scripts explicitamente `*:legacy-server` e não participa de `dev`, `build`, Playwright ou do shell principal.

## O que já está preparado para staging

O repositório já possui:

- workflow manual `Staging smoke` ligado ao GitHub Environment `staging`;
- validação de URL HTTPS e publishable key pública;
- probe real do boundary de Auth;
- prova de leitura anônima fail-closed em `households`;
- entrada obrigatória do SHA completo de 40 caracteres a homologar;
- checkout e confirmação desse SHA antes do teste;
- build, manifesto e artefato de staging vinculados ao mesmo commit;
- roteiro preenchível em `docs/operations/staging-evidence.md`.

**IMPLEMENTADO / EVIDENCIADO:** o workflow `Staging smoke` executou com sucesso na `main` para o SHA `020b02bc5753f6de353a5c6b4661db0c368b5f41` em 2026-09-21, em conjunto com a CI verde do mesmo commit. Isso fecha o gate automatizado de smoke do candidato contra o ambiente configurado. A homologação funcional humana e a prova de backup/restore permanecem separadas e obrigatórias.

## Roteiro funcional obrigatório de staging

- [x] Projeto Supabase de staging separado do projeto principal — confirmado em 2026-09-21 (`Casa Finance Staging` e `Casa Finance`, ambos `ACTIVE_HEALTHY`, região `sa-east-1`).
- [x] GitHub Environment `staging` operacional — evidenciado pelo `Staging smoke` verde contra o endpoint configurado.
- [x] Cadeia de migrations do staging conferida até `20260921020630_security_advisor_search_path_hardening`; a CI reconstrói banco isolado desde zero a cada gate.
- [x] Executar `Staging smoke` no SHA completo do candidato `020b02bc5753f6de353a5c6b4661db0c368b5f41` — execução automática verde em 2026-09-21.
- [ ] Registrar o artefato/manifesto associado ao mesmo SHA.
- [ ] Criar Casa e convidar o segundo membro.
- [ ] Sair e entrar novamente com os dois usuários.
- [ ] Cadastrar contas e cartões reais de homologação.
- [ ] Registrar salário recebido.
- [ ] Registrar despesa direta compartilhada e conferir comprador, responsável e pagador.
- [ ] Transferir entre contas e confirmar resultado econômico inalterado.
- [ ] Registrar compra no cartão parcelada sem débito bancário imediato.
- [ ] Pagar fatura e confirmar ausência de despesa duplicada.
- [ ] Reconhecer juros/tarifas/multa de empréstimo sem caixa e depois efetuar pagamento composto único.
- [ ] Conferir acerto realizado e projetado do casal.
- [ ] Validar investimento/aporte/resgate sem classificar transferência de patrimônio como renda/despesa.
- [ ] Tentar acessar a Casa com pessoa externa e confirmar bloqueio.
- [ ] Conferir comportamento em iPhone real de Wallace e Guilherme.

## Backup e recuperação

**DEFINIDO — estratégia de custo da Release 1:** não criar infraestrutura adicional paga sem aprovação explícita do PM. O projeto mantém os dois ambientes Supabase atuais e usa CI/ambiente local para ensaios descartáveis sempre que isso for tecnicamente equivalente.

A CI já prova **reconstrução estrutural** em ambiente isolado e descartável: inicia Supabase local vazio, reaplica todas as migrations e executa os gates financeiros, RLS, Auth e PostgREST. Isso reduz o risco de perda da definição do banco, mas **não equivale a restaurar os dados reais do staging**.

Para a Release 1, o gate de recuperação fica dividido em:

1. **reconstrução estrutural:** automatizada na CI, sem custo adicional;
2. **restauração de dados:** permanece pendente até existir mecanismo gratuito que permita gerar/restaurar um dump verificável do staging ou até aprovação explícita de infraestrutura paga;
3. nenhuma limitação do plano gratuito deve ser contornada com múltiplas contas como dependência arquitetural;
4. nenhuma publicação em produção deve depender de uma afirmação de backup que não tenha sido realmente testada.

Migrations financeiras devem continuar preferencialmente aditivas/forward-only. Evitar rollback destrutivo e `DROP CASCADE` em produção.

## Gate atual de publicação

**Decisão atual: NÃO PUBLICAR AINDA.**

A razão não é mais falta de persistência real, autenticação/RLS dinâmica, runtime Supabase, rastreabilidade do build ou smoke automatizado do candidato. Esses pontos já têm cobertura automatizada e o `Staging smoke` do SHA `020b02bc5753f6de353a5c6b4661db0c368b5f41` está verde. Os bloqueios Altos restantes são a prova reproduzível de backup/restore e a homologação humana conjunta do ciclo financeiro em dispositivos reais.

| Severidade | Pendência | Saída exigida |
|---|---|---|
| Alto | Restauração dos dados do staging ainda não foi comprovada; a reconstrução estrutural já é exercitada pela CI. | Antes da produção, provar restore de dados por mecanismo gratuito ou mediante aprovação explícita de custo. Isso não bloqueia preparar/executar a homologação funcional do beta. |
| Alto | Wallace e Guilherme ainda não homologaram juntos o ciclo mensal em dispositivos reais. | Executar `docs/operations/staging-evidence.md` nos dois logins e registrar bloqueadores. |
| Médio | Distribuição iOS/App Store ainda não foi preparada. | Definir wrapper/build/TestFlight somente após os itens Altos acima fecharem. |

Nenhuma publicação é autorizada enquanto houver item **Alto** aberto.

## Critério para liberar beta

Um beta privado pode ser preparado quando:

- staging estiver configurado e estável;
- o smoke do SHA candidato estiver verde;
- backup/restore tiver evidência reproduzível;
- os dois usuários conseguirem operar a mesma Casa sem intervenção manual em Supabase/Codespaces;
- nenhum fluxo financeiro crítico produzir duplicidade de despesa/receita/caixa;
- isolamento entre Casas permanecer verde;
- artefato e manifesto apontarem para o mesmo SHA homologado;
- CI do head exato do release estiver totalmente verde.

## Depois do beta

Somente após o beta funcional devem entrar em prioridade: empacotamento iOS, assinatura, distribuição, App Store/TestFlight e polimento específico de publicação. Isso evita gastar energia de release sobre uma base que ainda não foi homologada operacionalmente.
