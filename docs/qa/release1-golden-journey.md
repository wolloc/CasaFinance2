# Release 1 — Golden Journey de homologação

**Status:** DEFINIDO — gate de homologação pré-Go-live.

Objetivo: validar a jornada cotidiana do Casa Finance sem transformar projeção em realizado, pagamento em nova despesa ou transferência/acerto em renda.

## Gates automáticos já existentes

Antes da homologação manual, o release candidate deve passar, quando a infraestrutura de CI estiver disponível:

1. TypeScript: `npm run lint`;
2. unitários + integração: `npm test`;
3. smoke mobile Playwright: `npm run test:e2e`;
4. secret scan: `npm run check:secrets`;
5. build Vite: `npm run build`;
6. contratos Supabase, incluindo:
   - `pr_l_release1_golden_journey.test.sql`;
   - `pr_m_release1_everyday_extended.test.sql`;
   - `pr_n_release1_reconciliation.test.sql`;
   - demais gates posteriores registrados no workflow `CI`.

**PENDENTE operacional em 2026-09-25:** GitHub Actions está encerrando o job `TypeScript, tests and build` antes do primeiro step, sem Checkout, steps ou log. Isso deve ser tratado como indisponibilidade do gate, não como teste vermelho. Não alterar regra financeira para contornar o runner.

## Golden Journey manual do PM

Executar no ambiente de homologação com uma Casa de teste e dois membros.

### 1. Casa e posição inicial
- entrar na Casa;
- conferir nomes dos dois membros;
- conferir contas, cartões e saldos iniciais;
- validar que posição inicial não aparece como renda ou despesa;
- Home deve apresentar recursos, cartões e compromissos sem erro.

### 2. Nova Entrada
- registrar uma entrada conhecida para um membro;
- confirmar que o destino pertence ao membro ou é conta conjunta elegível;
- validar que **Confirmada** ainda não altera saldo;
- registrar o recebimento;
- validar que o saldo aumenta uma única vez e a entrada continua sendo um único fato econômico.

### 3. Despesa em conta
- registrar uma compra realizada;
- escolher comprador, responsabilidade e recurso de pagamento;
- validar uma única despesa econômica;
- validar redução do recurso usado;
- validar eventual posição entre membros quando responsabilidade e funding divergem.

### 4. Despesa no cartão
- registrar compra no cartão;
- validar que a compra aparece em **Gastos realizados** uma única vez pelo valor econômico;
- validar que a parcela/compromisso aparece na fatura/período financeiro aplicável;
- validar que a compra consome exposição do cartão, mas não reduz caixa antes do pagamento.

### 5. Fatura
- entrar pelo próprio card do cartão quando a jornada contextual estiver no release candidate;
- conferir cartão correto, fatura anterior/atual/próxima e lançamentos;
- pagar total ou parcialmente usando uma conta;
- validar que o caixa diminui apenas pelo valor pago;
- validar que pagar fatura **não cria nova despesa**.

### 6. Acerto entre membros
- partir de uma posição realizada existente;
- registrar pagamento parcial entre membros;
- validar redução somente da posição realizada;
- validar uma única transferência neutra entre recursos;
- validar que o acerto não vira renda ou despesa.

### 7. Gastos e Entradas
- navegar mês anterior/seguinte;
- alternar Nossa Casa / membro;
- conferir total, categorias e detalhe contextual;
- quando período personalizado estiver no release candidate, validar:
  - Gastos realizados pela data econômica;
  - Compromissos pela data financeira canônica;
  - intervalo cruzando meses sem duplicidade.

### 8. Fechamento
Aprovar somente se:
- nenhum fato econômico estiver duplicado;
- saldos fecharem com movimentos realizados;
- previsões permanecerem explicitamente não realizadas;
- fatura, transferências e acertos não criarem renda/despesa artificial;
- Home, Gastos, Entradas e Ajustes abrirem sem tela branca;
- ações críticas apresentarem confirmação/feedback de sucesso ou erro.

## Evidência mínima

Registrar para o release candidate:
- SHA exato;
- ambiente;
- resultado dos gates automáticos disponíveis;
- resultado dos oito blocos acima;
- bugs encontrados e severidade;
- decisão final: **APROVADO PARA GO-LIVE** ou **BLOQUEADO**.

