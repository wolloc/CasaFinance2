# Casa Finance — Financial Engine v2 Gap Map

## Objetivo e legenda

Este mapa compara o contrato v2 com a base existente após as migrations 001–021. Ele orienta evolução futura, mas **não define migrations, não autoriza implementação e não transforma legado em fonte canônica**.

| Símbolo | Classificação |
| --- | --- |
| 🟢 | existe / reutilizar |
| 🟡 | parcial / evoluir |
| 🔴 | ausente / construir |
| 🧹 | legado / não usar |

## Mapa técnico

### 🟢 Existe / reutilizar

| Capacidade / entidade | Direção |
| --- | --- |
| `transactions` | Preservar como evento econômico. |
| `economic_allocations` | Preservar como responsabilidade de membro/terceiro. |
| `financial_parties` | Reutilizar para terceiros sem Auth. |
| `financial_obligations` | Reutilizar para receivables/payables e empréstimos novos. |
| `obligation_events` | Reutilizar como histórico de liquidação/baixa. |
| `account_ownerships` | Reutilizar para ownership explícito e conjunto. |
| `account_balance_events` | Reutilizar para posição inicial/ajustes auditáveis. |
| `money_movements` | Reutilizar para caixa previsto/realizado. |
| `funding_events` realizados | Preservar para funding que efetivamente ocorreu. |
| `transaction_links` / `transaction_components` | Preservar vínculos e composição econômica. |
| `financing_allocations` | Reutilizar como ligação do mecanismo de financiamento. |
| fundações de recorrência | Preservar `recurring_rules` e `recurring_occurrences`. |
| cartões, faturas e parcelas | Preservar `cards`, `card_invoices`, `installments` e `card_invoice_payments`. |
| restrições de recursos | Reutilizar classificação de recursos restritos. |
| localização de dinheiro | Reutilizar suporte canônico de `cash`/localização. |

### 🟡 Parcial / evoluir

| Capacidade | Gap a resolver |
| --- | --- |
| recorrências completas | Completar edição “só este mês/daqui pra frente”, frequências e variáveis preservando estimativa. |
| estrutura de refund | Há vínculos/componentes, mas falta fluxo seguro para rotas e efeitos totais/parciais. |
| estrutura de financiamento | Base representa componentes/alocações; faltam comandos completos e projeções. |
| UX de investimento/reserva/benefício | Modelo parcial; falta experiência v2 e leitura segregada consistente. |
| reconciliação de `opening_balance` | `account_balance_events` existe, mas legado não deve ser reinterpretado automaticamente. |
| representação de pagador externo | Parties/allocations/obligations existem; falta fluxo operacional completo e intenção presente/reembolso. |
| comando de empréstimo tomado | Modelo de obrigação suporta; criação operacional completa ainda não. |
| read models atuais | Views v1 existem, mas não entregam mês financeiro, valor efetivo, projeção cumulativa e perspectivas v2. |

### 🔴 Ausente / construir

| Capacidade | Contrato necessário |
| --- | --- |
| mês financeiro canônico | Atribuir compromissos ao planejamento sem confundir data econômica/caixa. |
| read layer de hierarquia de valor efetivo | Selecionar realizado, senão confirmado, senão estimado, sem soma. |
| carry-forward de pendência anterior | Manter forecast vencido aberto sem mover origem ou realizar automaticamente. |
| projeção cumulativa | Saldo final de cada mês alimenta o seguinte. |
| acerto contínuo/projetado por membro | Separar posição realizada e projetada sem reset mensal. |
| perspectiva individual de liquidez | Aplicar 50/50 de conta conjunta somente à liquidez, preservando responsabilidade. |
| funding projetado | Representar funding futuro relacionado aos compromissos. |
| LIS | Modelar total, utilizado e disponível sem aumentar caixa. |
| exposição de crédito do cartão | Limites contratado/calculado/disponível separados de dinheiro e despesa. |
| agregação canônica de faturas futuras | Agregar parcelas/compromissos sem duplicar evento econômico. |
| saúde do cartão | Relacionar exposição, vencimento, cobertura e capacidade projetada. |
| saúde da Casa | Calcular classificação calibrável com agravantes. |
| confiança da projeção | Classificação qualitativa separada da saúde. |
| centro de atenção | Consolidar apenas causas acionáveis. |
| comando seguro de refund | Preservar origem, rota, parcialidade, autoria e atomicidade. |
| comando seguro de correção | Corrigir histórico e recalcular futuro atomicamente. |
| comando operacional de pagador externo | Exigir presente versus reembolso e gerar obrigações corretas. |
| comando operacional de empréstimo tomado | Separar principal, encargos, caixa e payable. |
| comando de PIX/financiamento no cartão | Preservar natureza do principal e separar taxa/juros. |
| comando de acerto programado entre membros | Afetar indivíduos na data e manter Casa = 0. |
| frontend Financial Engine v2 | Implementar Product Spec somente em etapa futura. |

### 🧹 Legado / não usar

| Artefato | Regra |
| --- | --- |
| `AppContent` | Não reativar; usa identidade e fluxos legados. |
| `ApiService` | Não conectar ao shell autenticado. |
| `DatabaseStore` / `server/db.ts` | Não usar como persistência canônica nem associar seeds a usuários reais. |
| dados demo e IDs fake | Não vincular a Auth/Supabase nem fazer backfill implícito. |
| dashboard legado e cálculos ad hoc React | Não usar como fonte financeira. |
| `accounts.opening_balance` legado | Não usar como fonte futura; reconciliar explicitamente. |
| `transaction_splits` | Compatibilidade apenas; novos fluxos usam `economic_allocations`. |

## Arquitetura autenticada e frontend

O shell atual autenticado deve ser preservado: `SupabaseAuthProvider` recupera a sessão; a boundary mostra autenticação/onboarding e, para usuário com Casa, monta `CasaFinanceApp`. As telas autenticadas usam o cliente Supabase, RLS, RPCs e read models. O `AppContent` com `AuthProvider`, `ApiService` e dados em memória continua no código apenas como legado e **não é montado** nessa rota.

Navegação autenticada atual:

```text
Casa / Lançamentos / Faturas / Ajustes
```

Destino do Product Spec v2:

```text
Casa / Gastos / Entradas / Ajustes
```

**Faturas sai da bottom navigation** e passa a ser contextual. Esta PR não altera o frontend. A implementação futura não deve reativar `AppContent`, `ApiService` ou `DatabaseStore`.

## Testes e invariantes futuros

1. TV 12x usa os meses financeiros corretos.
2. Compra de Guilherme no cartão de Wallace cria acerto projetado pelas parcelas.
3. Pagamento da fatura não duplica despesa nem acerto.
4. Conta conjunta afeta liquidez individual em 50/50 sem mudar responsabilidade.
5. Saldo negativo reduz caixa.
6. LIS não aumenta caixa.
7. Letícia gera receivable correto.
8. Recebimento de receivable não gera renda.
9. Terceiro paga: presente versus reembolso produz efeitos distintos.
10. Empréstimo concedido não vira despesa.
11. Empréstimo tomado não vira renda.
12. Refund não vira renda.
13. Partial settlement não marca tudo como `realized`.
14. Forecast vencido vira pendência anterior sem mover origem.
15. Recorrência variável preserva estimativa futura.
16. Projeção é cumulativa.
17. Acerto programado afeta posições individuais e Casa = 0.
18. Principal de investimento é patrimonial.

Também devem existir testes de atomicidade, idempotência, isolamento por Casa, fechamento em centavos e rastreabilidade das correções.

## Sequenciamento

As migrations 001–021 aplicadas são imutáveis. Evoluções de banco começam em **022+**, mas a divisão, quantidade e nomes exatos serão definidos na implementação futura — este mapa deliberadamente não os congela.
