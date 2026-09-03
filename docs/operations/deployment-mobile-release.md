# Publicação privada, produção e instalação no iPhone

> **Estado em 3 de setembro de 2026: preparado, mas não publicado.** Nenhuma URL foi criada porque não há autorização explícita nem credenciais de infraestrutura nesta execução. O gate `NÃO PUBLICAR` de homologação continua válido. Não inserir dados financeiros reais em staging.

> **Canal iOS:** a avaliação PWA × Capacitor e os gates para câmera, Keychain, biometria, deep links e TestFlight estão registrados no [ADR-001](../architecture/adr-001-capacitor-ios.md). Até os gates serem cumpridos, a PWA é o canal de homologação; não há binário autorizado para TestFlight ou App Store.

## Ambientes e URLs

| Ambiente | URL estável | Acesso | Dados |
|---|---|---|---|
| Staging | `PENDENTE — definir STAGING_APP_URL` | privado, liberado somente para Wallace e Guilherme no gateway do provedor | sintéticos |
| Produção | `PENDENTE — definir PRODUCTION_APP_URL` | não publicar antes do aceite registrado | projeto produtivo |

Reservar domínios diferentes, por exemplo `staging.finance.<domínio>` e `finance.<domínio>`, e apontá-los somente depois da autorização. HTTPS deve terminar no provedor com renovação automática. A aplicação redireciona tráfego encaminhado como HTTP e aceita CORS apenas das origens em `CORS_ORIGINS`.

## Topologia e segregação

- Um serviço Node/Express por ambiente executa a imagem do `Dockerfile`; ele também entrega o frontend React compilado.
- Usar **dois projetos Supabase**, `casa-finance-staging` e `casa-finance-production`. Não reutilizar banco, Storage, JWT secret ou service role. Se o plano não permitir dois projetos, usar bancos/roles/schemas separados e registrar formalmente a exceção antes de avançar.
- Proteger staging na borda (Access/SSO do provedor) com allowlist apenas das duas contas dos validadores. A proteção deve abranger frontend e `/api`; `robots` não é controle de acesso.
- Configurar `staging` e `production` como GitHub Environments, com reviewers obrigatórios e segredos próprios. Nunca usar secrets de produção em staging.

## Secrets fora do Git

Cadastrar diretamente no secret manager do host: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `APP_URL` e `CORS_ORIGINS`. Definir também `APP_ENV`, `COMMIT_SHA`, `PORT` e `ENFORCE_HTTPS=true`. No GitHub Environment, manter somente `DEPLOY_HOOK_URL`. Rotacionar imediatamente qualquer valor que apareça em log, issue ou chat.

O frontend Vite precisa receber `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` **durante a construção da imagem**, pois esses valores públicos são incorporados ao bundle pelo `npm run build`. Exporte os valores no ambiente do processo de build e repasse-os como argumentos, sem gravá-los no Dockerfile ou no repositório:

```sh
docker build \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
  -t casa-finance:"$COMMIT_SHA" .
```

Essas duas variáveis são configuração **pública** do cliente, não segredos. Nunca passe `service_role`, secret key, `DATABASE_URL` ou senha PostgreSQL como `--build-arg`: mantenha credenciais privilegiadas somente no secret manager e injete-as no container em tempo de execução. Gere uma imagem distinta por ambiente quando os projetos Supabase forem diferentes.

## Checklist de publicação

### Staging privado

- [ ] Todos os bloqueadores críticos/altos de `release-readiness.md` encerrados.
- [ ] Projeto Supabase exclusivo criado; migrations aplicadas em ordem e RLS validada com dois JWTs.
- [ ] Massa **sintética** carregada e conferida; nenhum dump de produção usado.
- [ ] Gateway privado testado com Wallace, Guilherme e um terceiro usuário bloqueado.
- [ ] DNS, certificado HTTPS, `APP_URL` e allowlist `CORS_ORIGINS` configurados.
- [ ] Secrets inseridos pelo painel/CLI do provedor e secret scan aprovado.
- [ ] Backup criado, restaurado em projeto isolado e reconciliado.
- [ ] Alertas de uptime, HTTP 5xx, latência, reinícios e uso do banco direcionados ao responsável.
- [ ] Workflow **Deploy approved release** disparado para `staging` somente após CI verde e aprovação do Environment.
- [ ] Smoke test e roteiro funcional abaixo anexados ao change record.

### Produção

- [ ] Aceite de Wallace e Guilherme registrado, incluindo limitações conhecidas.
- [ ] Mesmo commit validado em staging identificado por `COMMIT_SHA`.
- [ ] Projeto Supabase produtivo vazio/validado, backup pré-mudança e ponto de restauração confirmados.
- [ ] Domínio produtivo, HTTPS, CORS, gateway/autenticação e alertas verificados.
- [ ] Reviewer autoriza o GitHub Environment `production`; workflow executado com `release_authorized=true`.
- [ ] Pós-deploy concluído sem escrever dados de teste no banco produtivo.

## Instruções para Wallace e Guilherme

1. Abram a URL privada de staging recebida pelo canal seguro e autentiquem-se no gateway com a conta autorizada.
2. Usem apenas os usuários e valores fictícios fornecidos para homologação.
3. No iPhone, abram a URL em **Safari** (não no navegador interno de outro app).
4. Toquem em **Compartilhar** e depois em **Adicionar à Tela de Início**. Se a opção estiver oculta, rolem a lista e usem **Editar Ações**.
5. Confirmem o nome **Casa Finance**, toquem em **Adicionar** e abram pelo novo ícone.
6. Após uma nova versão, fechem e reabram o app; quando o aviso de atualização aparecer, apliquem-no. Em cache persistente, removam o ícone, limpem os dados do site no Safari e instalem novamente.

## Teste pós-deploy

1. `curl --fail --silent --show-error "$APP_URL/api/health"` deve retornar `status: ok`, ambiente e commit esperados sem secrets.
2. Verificar certificado, redirect HTTP→HTTPS, CSP, HSTS, `X-Content-Type-Options` e `X-Frame-Options`.
3. Confirmar que origem fora da allowlist recebe 403 e que o terceiro usuário não acessa a casa.
4. Executar o roteiro funcional de dez itens de `release-readiness.md`, incluindo transferência neutra, compra no cartão sem débito bancário, pagamento de fatura sem despesa duplicada e acertos realizado/projetado.
5. Reiniciar uma instância, autenticar novamente e confirmar persistência.
6. Fazer OCR de documento sintético, revisar antes de confirmar e conferir que o log não contém imagem, descrição, valor nem chave.
7. Instalar a PWA em um iPhone real, abrir em modo standalone e validar safe areas, câmera/upload, atualização e reconexão.

## Monitoramento, backup e rollback

- Monitorar externamente `/api/health` a cada minuto e alertar após três falhas; no host, alertar 5xx, p95, memória e reinícios; no Supabase, conexões, armazenamento, erros e auth. Logs estruturados devem reter apenas metadados já sanitizados.
- Executar backup diário (RPO 24 h), reter 30 dias e cópia semanal por 90 dias. Mensalmente restaurar em projeto isolado, medir o RTO (meta 4 h), comparar contagens e reconciliar saldos/faturas.
- **Rollback de aplicação:** pausar promoção, desabilitar writers se houver risco contábil, selecionar o último `COMMIT_SHA` aprovado no host e redeployar. Validar health e smoke antes de reabrir acesso.
- **Rollback de banco:** migrations são roll-forward e aditivas. Não fazer `DROP CASCADE`. Em corrupção, congelar writers, restaurar o backup em projeto isolado, validar reconciliação, trocar as conexões pelo secret manager e só então liberar. Registrar perda dentro do RPO.

## Limitações conhecidas e decisão

- A persistência principal ainda é em memória; reinícios podem perder dados. Portanto, este pacote **não autoriza staging nem produção** até a troca pelo adaptador PostgreSQL/Supabase transacional.
- Não há E2E em navegador nem validação com Supabase real nesta árvore. A instalação PWA precisa de evidência em iPhone físico.
- O health check informa configuração, mas não prova conectividade com PostgreSQL, Supabase ou Gemini.
- O workflow é manual e genérico: o secret `DEPLOY_HOOK_URL`, os ambientes protegidos, os domínios, o gateway privado, backups e alertas precisam ser provisionados pelo operador.
- SVG `any maskable` funciona como fallback, mas um pacote de ícones PNG Apple Touch/Icon deve ser validado antes do lançamento público.

Até esses itens serem resolvidos e haver autorização explícita, manter ambos os endpoints indisponíveis ao público.
