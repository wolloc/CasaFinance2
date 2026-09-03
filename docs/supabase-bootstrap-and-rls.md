# Bootstrap do Supabase e isolamento por casa

## Problemas encontrados na auditoria

As migrations `001` a `003` criavam o ledger, a personalizacao de membros e os
movimentos de receita nessa ordem. A migration `004` anterior habilitava RLS
somente em parte do schema: `profiles`, `settlements`, `audit_logs`,
`document_imports` e `merchant_category_rules` ficavam sem cobertura. Tambem nao
havia fluxo para criar perfil, casa e primeiro membro. A politica de `households`
exigia uma membership que ainda nao podia existir, causando um bloqueio circular.

O uso de uma unica politica `FOR ALL` tambem permitia alterar e excluir logs de
auditoria. Nao havia distincao entre administracao de membros e operacoes
financeiras comuns.

## Fluxo de bootstrap

1. O trigger `on_auth_user_created` cria `profiles` depois do cadastro em
   `auth.users`.
2. O cliente autenticado chama somente
   `rpc('bootstrap_household', { household_name: 'Minha casa' })`.
3. A funcao valida `auth.uid()`, cria a casa e associa o chamador como `owner` na
   mesma transacao. Se qualquer etapa falhar, nada e persistido.
4. Nao existe politica de `INSERT` direto em `households`. Isso impede casas
   orfas e resolve o bootstrap sem abrir uma excecao RLS generica.

As funcoes `SECURITY DEFINER` fixam o `search_path`, tem acesso publico revogado e
expoem apenas as operacoes minimas aos usuarios autenticados. A aplicacao web nao
precisa e nao deve receber a chave `service_role`; no frontend deve existir apenas
a chave publica (`anon`/publishable).

## Cobertura RLS

- `profiles`: leitura propria ou de membros ativos da mesma casa; atualizacao
  somente do proprio perfil.
- `households`: leitura por membro; atualizacao/exclusao por owner; criacao apenas
  pela RPC atomica.
- `household_members`: leitura por membro e administracao somente por owner. Um
  trigger impede remover ou rebaixar o ultimo owner ativo.
- Todas as tabelas financeiras, de importacao e regras: acesso somente para um
  membro ativo cujo `household_id` corresponda ao registro.
- `audit_logs`: leitura e inclusao por membro, sem update ou delete pela API.
- `anon`: privilegios de tabelas publicas e funcoes sensiveis revogados.

O teste pgTAP usa exclusivamente identidades ficticias e transacionais. Ele cobre
criacao de perfil, bootstrap da primeira casa, owner inicial, dois membros, um
terceiro usuario, anonimato e isolamento entre duas casas. O `ROLLBACK` final
garante que os dados do teste nunca sejam seeds.

## Aplicacao em um projeto Supabase vazio

1. Instale a Supabase CLI e autentique-se fora do frontend.
2. Na raiz do repositorio, associe o projeto: `supabase link --project-ref REF`.
3. Confira o plano com `supabase db diff --linked` e revise os quatro arquivos em
   `supabase/migrations`.
4. Aplique em ordem com `supabase db push --linked`.
5. Em ambiente local descartavel, valide com `supabase start` e
   `supabase test db` antes de aplicar no projeto remoto.

Esta PR nao executa `db push`, deploy, seed ou conexao dos componentes React.

## Rollback

Antes da primeira aplicacao remota, o rollback recomendado e descartar o banco
local com `supabase db reset` ou recriar o projeto vazio. Depois de aplicada em um
ambiente que contenha dados, nao reverta removendo tabelas: crie uma migration
compensatoria que remova as policies e triggers desta revisao e restaure a versao
anterior das funcoes. Faça backup com `supabase db dump` antes da compensacao.

Para uma instalacao vazia e ainda sem dados, uma compensacao pode remover, nesta
ordem, o trigger `on_auth_user_created`, as funcoes de bootstrap/autorizacao e as
policies; depois, as migrations de schema podem ser revertidas na ordem
`003`, `002`, `001`. Essa operacao e destrutiva e nao deve ser usada em producao.
