# Arquitetura atual e auditoria técnica

Auditoria da revisão `80641cc` (PR localmente registrada como `#1`) em 3 de setembro de 2026. A inspeção do histórico remoto ficou limitada pelo bloqueio de rede do ambiente; o histórico Git disponível contém a inicialização e a entrega de contas fixas/comprador.

## Visão geral

O repositório é um monólito TypeScript executado por Node.js:

```text
React 19 + Motion + Lucide + Tailwind 4
                │ HTTP / JSON
                ▼
       Express (`server/index.ts`)
                │ chamadas diretas
                ▼
 In-memory DB (`server/db.ts`, Maps + seeds)

Contrato SQL futuro/paralelo: `schema.sql` (PostgreSQL/Supabase)
OCR: `server/geminiOcr.ts` → Gemini, com fallback demonstrativo
```

- **Bootstrap:** `src/main.tsx` monta `App`; `src/App.tsx` mantém navegação, filtros globais e carregamento das coleções.
- **Interface:** componentes organizados por sprint/área (`dashboard`, `income`, `common`, `sprint1`…`sprint8`). A navegação ativa expõe Dashboard, Lançamentos, Entradas e Ajustes.
- **Cliente HTTP:** `src/services/api.ts` concentra chamadas e cabeçalhos de usuário/casa, mas também contém respostas fallback fixas.
- **API:** `server/index.ts` agrega middleware, handlers, validação parcial, suíte de segurança e integração OCR.
- **Negócio e persistência:** `server/db.ts` concentra seeds, Maps, mutações, auditoria e cálculos; não persiste reinícios.
- **Domínio puro:** `src/domain/ledger.ts` é o motor canônico de eventos/postings; `src/domain/finance.ts` mantém a API legada e delega saldos e resultado ao ledger.
- **Banco alvo:** `schema.sql` descreve enums, tabelas, RLS, funções e views de Supabase, porém não é utilizado pelo servidor em execução.

## Rotas e responsabilidades

| Grupo | Rotas |
| --- | --- |
| Saúde/autenticação | `GET /api/health`, `GET /api/auth/users`, `POST /api/auth/login` |
| Casa | `GET /api/households/:householdId`, `POST .../members` |
| Contas | `GET/POST .../accounts`, `PUT/DELETE .../accounts/:accountId` |
| Cartões | `GET/POST .../cards`, `PUT/DELETE .../cards/:cardId`, `GET .../calculate-dates` |
| Categorias | `GET/POST .../categories`, `PUT .../categories/:categoryId` |
| Lançamentos | `GET/POST .../transactions`, `PUT/DELETE .../transactions/:transactionId`, `POST .../refund`, `POST .../check-duplicates`, `POST .../bulk-import` |
| Acerto | `GET .../settlement`, `GET .../couple-settlement`, `POST .../couple-settlement/record` |
| Fixas/projeção | `GET/POST .../recurring-bills`, `PATCH .../toggle-active`, `DELETE .../:billId`, `GET .../bill-occurrences`, `PUT .../occurrences/:id`, `POST .../pay`, `GET .../commitments-projection` |
| Dashboard/reservas | `GET .../dashboard`, `GET .../protected-funds`, `GET .../reserve-drainages`, `POST .../protected-funds/drain` |
| OCR/reconciliação | `POST .../ocr/receipt`, `POST .../ocr/invoice-pdf`, `GET/POST/DELETE .../merchant-rules`, `GET .../document-imports` |
| Diagnóstico | `POST /api/tests/run-security-suite` |

Todas as rotas de Casa usam `requireHouseholdAccess`; autenticação é simulada por `x-user-id` e `x-household-id`, com defaults fixos, e não por sessão/JWT verificado.

## Componentes e fluxos

- **Shell:** `App`, `AuthContext`, `Header`, `DraggableFloatingActions`, `IOSBottomSheet`, `QuickAddModal`.
- **Dashboard:** `HomeDashboard` orquestra `MainMetricsCard`, cartões/contas, categorias, compromissos, projeções, patrimônio, fundos e acerto.
- **Lançamentos:** `TransactionsTimeline`, `NewTransactionModal` e `EditOccurrenceModal` consultam e mutam transações/ocorrências.
- **Entradas:** `IncomeManager` delega a interface extensa de receitas e reservas para `Entradas`.
- **Configuração:** `SettingsAndHouseholdManager` reúne `AccountsManager`, `CardsManager` e `CategoriesManager`.
- **Módulos fora da navegação principal:** gerenciadores de recorrência/OCR, acerto detalhado e telas de auditoria/segurança permanecem no código, mas não são montados diretamente pelo `App` atual.

## Entidades e fonte de persistência

O processo atual mantém em `Map`: `User`, `Household`, `HouseholdMember`, `Account`, `Card`, `PaymentMethod`, `Category`, `ProtectedFund`, `ReserveDrainage`, `Transaction`, `TransactionSplit`, `InstallmentPlan`, `Installment`, `Invoice`, `Settlement`, `RecurringBill`, `BillOccurrence`, `DocumentImport` e `MerchantCategoryRule`; logs ficam em array limitado a 500 itens.

O SQL cobre contas, cartões, categorias, recorrências, ocorrências, acertos, documentos e regras de lojista, além de views de dashboard. Há divergência entre o modelo de execução em memória e o modelo SQL: o servidor não cria cliente PostgreSQL/Supabase.

## Fonte de verdade de saldos e projeções

| Indicador | Fonte atual | Regra observada / risco |
| --- | --- | --- |
| Saldo de conta | `Account.current_balance` mutado em `server/db.ts` | É um snapshot em memória e pode divergir do histórico de transações. |
| Fatura de cartão | `Invoice` e agregações de parcelas/transações em `server/db.ts` | Há mais de um caminho de agregação; exige reconciliação por IDs. |
| Resultado mensal | transações `completed` de receita/despesa filtradas pela data | Deve excluir transferência e pagamento de fatura; contrato formalizado no módulo puro. |
| Saldo real consolidado | soma de contas ativas no dashboard | Não deve aplicar ocorrências `pending`/previstas. Fundos protegidos são exibidos separadamente. |
| Patrimônio líquido | saldo das contas menos faturas abertas | Não inclui ainda passivos de empréstimos nem integração real com investimentos. |
| Projeção mensal | `getFutureCommitmentsProjection`: ocorrências fixas pendentes + parcelas agendadas | Risco de duplicar regra, ocorrência e transação; deduplicação por ID/competência agora tem contrato puro. |
| Saldo projetado | `projectDashboardFromLedger` aplica receitas previstas e compromissos aos postings | O DTO `accounting` é calculado no domínio/servidor; o componente principal somente formata os valores. |
| Acerto do casal | postings e responsabilidades do ledger | Despesa direta deriva o financiador do titular da origem; compra no cartão permanece obrigação projetada até a liquidação, sem inferir financiamento do titular do cartão. |

## Valores fixos e dados de demonstração

- IDs centrais: `usr-wallace-001`, `usr-guilherme-002`, `hh-wallace-gui-001`; contas, cartões e categorias usam IDs semeados em `server/db.ts`.
- Nomes, e-mails, PIX, instituições, saldos, limites, transações, contas fixas, fundos e regras de lojista são seeds no construtor do banco em memória.
- `AuthContext` inicia Wallace; o middleware também assume Wallace e a Casa quando os headers não existem.
- `App` inicia a competência na data local da Casa; alguns fallbacks legados da API e do acerto ainda repetem `2026-05`.
- Filtros e tipos codificam `wallace | guilherme`; não derivam membros da Casa.
- A suíte HTTP de segurança usa IDs, nomes, datas de maio/junho de 2026 e o casal fixo.
- O fallback de OCR retorna itens demonstrativos e inclui valor preparado para demonstrar detecção de duplicidade.

## Dívidas técnicas priorizadas

### P0 — integridade financeira e segurança

1. **Vínculo de faturas legadas:** o ledger já separa obrigação projetada de financiamento realizado, mas os registros antigos ainda precisam de vínculo persistido entre pagamento de fatura e responsabilidades das compras liquidadas.
2. **Persistência não durável:** produção usa Maps e seeds; conectar repositórios PostgreSQL/Supabase, transações ACID e migrations antes de dados reais.
3. **Autenticação permissiva:** headers ausentes assumem Wallace; validar token/sessão e derivar Casa autorizada no servidor, sem confiar em headers do cliente.
4. **Duas fontes de verdade:** snapshots de saldo e histórico são mutados juntos sem ledger/reconciliação transacional.

### P1 — arquitetura e consistência

5. Integrar gradualmente `src/domain/finance.ts` aos casos de uso do servidor, mantendo handlers, negócio e repositórios separados.
6. Substituir IDs e união fixa de dois nomes por membros consultados da Casa; acerto deve aceitar N membros mesmo que a UI continue voltada ao casal.
7. Versionar o DTO contábil do dashboard e migrar os cartões secundários legados para o mesmo read model já usado pelos indicadores principais.
8. Garantir idempotência persistida em ocorrências, parcelas, importações e pagamento de fatura (constraints/chaves de negócio).
9. Alinhar `schema.sql`, interfaces TypeScript e Maps; hoje entidades/campos não têm uma migration executável única.

### P2 — manutenção e qualidade

10. Decompor `server/db.ts`, `server/index.ts` e componentes com centenas/milhares de linhas.
11. Eliminar usos existentes de `any` em handlers, API e componentes, adicionando schemas de validação na fronteira HTTP/OCR.
12. Criar testes de integração da API e PostgreSQL, testes de contrato do OCR e testes E2E mobile/iPhone.
13. Trocar mês inicial fixo pela competência local da Casa (`America/Sao_Paulo`) e injetar relógio nos testes.
14. Remover ou expor conscientemente telas de sprint não alcançáveis pela navegação, reduzindo código morto e contratos paralelos.

## Próxima integração recomendada

1. Criar casos de uso TypeScript (`CreateTransaction`, `PayInvoice`, `TransferFunds`) que chamem as funções puras.
2. Definir interfaces de repositório e duas implementações temporárias: memória para testes e Supabase/PostgreSQL para execução.
3. Migrar primeiro transferência e cartão em transação atômica, com chave de idempotência.
4. Recalcular e comparar saldos históricos em modo sombra; bloquear divergências antes de remover os cálculos legados.
