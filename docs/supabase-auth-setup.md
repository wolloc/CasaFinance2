# Supabase Auth: configuração operacional

Esta etapa conecta **somente identidade e sessão** ao Supabase. As entidades financeiras continuam no `DatabaseStore` em memória e não são carregadas depois do login. A tela “Configuração inicial pendente” é intencional: ela evita associar um usuário real aos IDs fictícios existentes. `bootstrap_household`, profile e membership ficam para a próxima etapa.

## Variáveis do frontend

1. No Supabase Dashboard, abra **Project Settings > API**.
2. Copie **Project URL** para `VITE_SUPABASE_URL`.
3. Copie a **Publishable key** para `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. No Codespaces, crie `.env.local` (ignorado pelo Git) ou configure essas duas variáveis como secrets do Codespace e reinicie `npm run dev`.

As duas variáveis `VITE_*` são públicas: o Vite as inclui no JavaScript entregue ao navegador. O acesso aos dados deverá ser protegido pelas políticas RLS.

Nunca use no frontend nem prefixe com `VITE_`: `service_role`, secret key, senha PostgreSQL, `DATABASE_URL` ou qualquer credencial administrativa. As variáveis sem `VITE_` presentes no `.env.example` pertencem exclusivamente ao servidor/local development e não são lidas pelo cliente Supabase.

Foi adotado o nome atual **Publishable key** do Supabase. Projetos antigos podem mostrar uma chave `anon`; não renomeie nem exponha uma secret/service-role key. Prefira gerar/copiar a Publishable key na página API Keys do projeto.

## Configuração do Auth no Supabase

1. Em **Authentication > Providers**, mantenha Email habilitado.
2. Defina se **Confirm email** ficará ativo. Quando ativo, cadastro informa que a confirmação é necessária e login só funcionará depois do link recebido.
3. Em **Authentication > URL Configuration**, configure o Site URL do ambiente (por exemplo, a URL encaminhada do Codespaces) e inclua URLs de redirect necessárias.
4. Não execute seed e não crie Wallace ou Guilherme para testar.

## Teste manual

1. Copie `.env.example` para `.env.local` e substitua apenas as duas variáveis públicas `VITE_SUPABASE_*` pelos valores do projeto.
2. Execute `npm run dev` e abra a URL exibida.
3. Em **Criar conta**, informe um e-mail real de teste e senha com seis ou mais caracteres. Confirme o e-mail se essa opção estiver ativa.
4. Em **Entrar**, use essas credenciais. Recarregue a página e confirme que a sessão permanece ativa.
5. Confirme a tela explícita de configuração pendente e clique **Sair**. A tela de login deve reaparecer.

Nenhuma Casa é criada por esse roteiro e nenhum dado financeiro legado é vinculado ao `auth.users.id`. Até a próxima etapa, o app financeiro fica deliberadamente bloqueado após a autenticação.
