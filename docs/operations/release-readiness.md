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

**Isso é preparação, não evidência de staging concluída.** O bloqueador só fecha após uma execução verde contra um projeto Supabase de staging real.

## Roteiro funcional obrigatório de staging

- [ ] Criar projeto Supabase de staging separado de produção.
- [ ] Configurar o GitHub Environment `staging` com URL e publishable key públicas do projeto.
- [ ] Aplicar todas as migrations desde zero e comparar com a CI.
- [ ] Executar `Staging smoke` informando o SHA completo do candidato.
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

Antes de qualquer produção, staging deve provar o procedimento completo de backup e restore. Não basta ter o comando documentado.

Fluxo mínimo:

1. gerar dump verificável do banco de staging;
2. restaurar em projeto isolado;
3. aplicar migrations pendentes de forma controlada;
4. comparar contagens e posições financeiras relevantes;
5. executar os gates de RLS/Auth/financeiro contra a restauração;
6. registrar duração, artefatos e responsável pela validação.

Migrations financeiras devem continuar preferencialmente aditivas/forward-only. Evitar rollback destrutivo e `DROP CASCADE` em produção.

## Gate atual de publicação

**Decisão atual: NÃO PUBLICAR AINDA.**

A razão não é mais falta de persistência real, autenticação/RLS dinâmica, runtime Supabase ou rastreabilidade do build. Esses pontos já têm cobertura no Marco 3. Os bloqueios restantes dependem de ambiente real e homologação humana.

| Severidade | Pendência | Saída exigida |
|---|---|---|
| Alto | Ainda não há execução registrada do staging real. | Criar/configurar o projeto de staging e executar o `Staging smoke` no SHA candidato. |
| Alto | Backup/restore ainda não foi comprovado em ambiente de staging. | Restaurar dump em projeto isolado e reconciliar posições financeiras. |
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
