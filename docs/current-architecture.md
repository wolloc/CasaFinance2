# Arquitetura atual do Casa Finance

Atualizado no Marco 3 após a validação do fluxo real com Supabase local, Auth/JWT/PostgREST, RLS e comandos financeiros canônicos.

## Visão geral

```text
React 19 / TypeScript / Vite
            │
            ▼
SupabaseAuthProvider + CasaFinanceApp
            │ JWT real
            ▼
Supabase Auth + PostgREST
            │
            ▼
PostgreSQL / RLS / RPCs canônicos
            │
            ├─ migrations versionadas
            ├─ read models financeiros
            └─ fatos econômicos, obrigações, funding e caixa
```

O `src/App.tsx` monta exclusivamente o fluxo Supabase. O shell legado baseado em `AuthProvider`, `ApiService` e identidade demo foi removido do root no Marco 3.07.

O diretório `server/` permanece como legado histórico/experimental e **não é a fonte de verdade do app real**. Nenhum caminho de produção deve depender de Maps, headers simulados ou usuários fixos desse servidor.

## Autenticação e Casa

- Supabase Auth emite a sessão/JWT real.
- `SupabaseAuthProvider` recupera a sessão e a Casa do usuário.
- O primeiro usuário cria a Casa pelo RPC `bootstrap_household`.
- Convites e aceite unem Wallace e Guilherme à mesma Casa real.
- `household_id` é a fronteira multi-tenant.
- RLS usa a identidade autenticada e membership ativa; uma pessoa externa não enxerga fatos de outra Casa.
- Helpers internos como `require_active_member` não são executáveis diretamente pelo cliente.

## Persistência e segurança

A fonte de verdade é PostgreSQL/Supabase. O histórico de migrations é reproduzido do zero na CI em um Supabase local descartável.

A escrita financeira sensível acontece por comandos/RPCs canônicos. Tabelas que representam fatos compostos ou auditáveis podem permanecer legíveis por RLS, mas sem escrita direta do cliente quando a criação deve passar pelo comando de domínio. Exemplo já endurecido: `external_payment_events`.

Funções `SECURITY DEFINER` expostas ao cliente usam `search_path` fixo e continuam validando explicitamente a Casa/membership antes da mutação.

## Modelo financeiro

As dimensões abaixo são independentes e não podem ser inferidas umas das outras:

- **Comprador:** quem originou/atuou na compra.
- **Responsabilidade econômica:** quem efetivamente recebe a despesa/receita.
- **Titularidade do cartão/conta:** propriedade do instrumento.
- **Pagador / funder:** quem financiou ou pagou.
- **Caixa:** conta/recurso em que ocorreu o movimento real.

Regras centrais:

- compra gera despesa; pagamento de fatura não gera nova despesa;
- receber um direito já reconhecido não gera nova receita;
- pagar uma obrigação já reconhecida não gera nova despesa;
- empréstimo concedido/tomado não é despesa/receita;
- juros, tarifas e multas são reconhecidos como custo econômico antes do pagamento;
- pagamento composto do empréstimo movimenta caixa uma única vez;
- aporte/resgate de investimento é movimento de caixa, não receita/despesa;
- projeções não reescrevem fatos realizados;
- criação de PIX no cartão não movimenta caixa bancário naquele instante.

## Fluxo de aplicação atual

1. `src/main.tsx` monta `App`.
2. `App` monta `SupabaseAuthProvider`.
3. Sem sessão, aparece `AuthScreen`.
4. Com sessão e sem Casa, aparece `HouseholdOnboarding`.
5. Com sessão e Casa, monta `CasaFinanceApp`.
6. A UI consulta read models e executa operações canônicas via Supabase.

A interface não deve recriar regra financeira por conta própria. Regra financeira pertence ao domínio/RPC; a UI apenas coleta intenção, apresenta contexto e chama o comando correto.

## Gates de CI atuais

### Frontend / aplicação

- TypeScript/lint;
- testes unitários e de integração;
- Playwright Chromium com smoke E2E;
- scan de segredos;
- `npm audit` em severidade alta;
- build de produção.

### Banco / segurança

- Supabase local isolado em runner novo;
- replay de todas as migrations desde zero;
- pgTAP dinâmico de RLS com múltiplas identidades e `anon`;
- Auth real + JWT + PostgREST;
- convite e Casa compartilhada reais;
- despesa direta real com comprador, responsabilidade e funder independentes;
- isolamento financeiro entre Casas.

## Estado das validações do Marco 3

Já existe evidência automatizada de:

- migration replay completo em banco vazio;
- RLS dinâmica;
- login/sessão/JWT reais;
- convite e aceite entre duas pessoas;
- relogin e continuidade da Casa;
- despesa real pela fronteira HTTP do Supabase;
- uma única saída de caixa para a liquidação direta testada;
- isolamento de transações, alocações, funding e movimentos para pessoa externa.

## Dívidas técnicas ainda relevantes

1. Manter `server/` e OCR legados explicitamente fora do caminho de produção ou removê-los quando não forem mais úteis.
2. Atualizar continuamente read models e testes HTTP conforme novos fluxos financeiros forem promovidos para homologação real.
3. Criar/validar ambiente de staging com projeto Supabase separado antes de qualquer produção.
4. Executar backup/restore de verdade em staging e registrar evidências.
5. Rodar homologação funcional completa com Wallace e Guilherme em dispositivos reais.
6. Depois disso, preparar empacotamento/distribuição iOS e processo de publicação.

## Regra de arquitetura

Qualquer nova funcionalidade deve responder a duas perguntas antes do merge:

> Wallace e Guilherme conseguiriam usar isso sem conhecer como o Casa Finance foi programado?

> A operação preserva economia, obrigação, funding e caixa sem inferências ou duplicidade?

Se qualquer resposta for “não”, a funcionalidade ainda não está pronta para ser promovida.
