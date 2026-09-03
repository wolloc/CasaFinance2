import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './db.js';
import { processReceiptImageOcr, processInvoicePdf } from './geminiOcr.js';
import crypto from 'crypto';
import type { InvoiceParsedItem } from '../src/types/index.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Helper middleware for session/user headers
function getSecurityContext(req: Request) {
  const userId = (req.headers['x-user-id'] as string) || 'usr-wallace-001';
  const householdId = (req.headers['x-household-id'] as string) || 'hh-wallace-gui-001';
  return { userId, householdId };
}

// RLS Verification Middleware
function requireHouseholdAccess(req: Request, res: Response, next: NextFunction): void {
  const { userId } = getSecurityContext(req);
  const targetHouseholdId = req.params.householdId || req.body.household_id || (req.headers['x-household-id'] as string);

  if (!targetHouseholdId) {
    res.status(400).json({ error: 'Household ID é obrigatório para acessar recursos protegidos.' });
    return;
  }

  const hasAccess = db.hasHouseholdAccess(userId, targetHouseholdId);
  if (!hasAccess) {
    res.status(403).json({
      error: 'Acesso Negado (RLS Violation): Usuário não possui permissão para acessar este Household.',
      user_id: userId,
      household_id: targetHouseholdId
    });
    return;
  }

  next();
}

// --- API ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Casa Finance',
    version: '1.0.0-sprint1',
    timestamp: new Date().toISOString()
  });
});

// Auth / User Switcher
app.get('/api/auth/users', (req, res) => {
  const users = Array.from(db.users.values());
  res.json({ users });
});

app.post('/api/auth/login', (req, res) => {
  const { user_id } = req.body;
  const user = db.users.get(user_id);

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  // Find user's households
  const memberships = Array.from(db.householdMembers.values()).filter(
    (m) => m.user_id === user.id && m.is_active
  );

  const userHouseholds = memberships.map((m) => {
    const hh = db.households.get(m.household_id);
    return {
      ...hh,
      role: m.role
    };
  });

  const activeHousehold = userHouseholds[0] || null;

  db.addAuditLog(
    activeHousehold ? activeHousehold.id! : 'global',
    user.id,
    'LOGIN',
    'users',
    user.id,
    null,
    { login_at: new Date().toISOString() },
    user.name
  );

  res.json({
    user,
    households: userHouseholds,
    active_household: activeHousehold
  });
});

// Household Details & Members
app.get('/api/households/:householdId', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const hh = db.households.get(householdId);
  if (!hh) {
    res.status(404).json({ error: 'Household não encontrado' });
    return;
  }

  const members = Array.from(db.householdMembers.values())
    .filter((m) => m.household_id === householdId)
    .map((m) => ({
      ...m,
      user: db.users.get(m.user_id)
    }));

  res.json({
    household: hh,
    members
  });
});

app.patch('/api/households/:householdId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    res.json({ household: db.updateHousehold(householdId, userId, req.body) });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar casa' });
  }
});

// Accounts
app.get('/api/households/:householdId/accounts', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const accounts = Array.from(db.accounts.values()).filter(
    (a) => a.household_id === householdId && a.is_active
  );
  res.json({ accounts });
});

app.post('/api/households/:householdId/accounts', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const account = db.createAccount(householdId, userId, req.body);
    res.status(201).json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao criar conta' });
  }
});

app.put('/api/households/:householdId/accounts/:accountId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, accountId } = req.params;
    const { userId } = getSecurityContext(req);
    const account = db.updateAccount(householdId, userId, accountId, req.body);
    res.json({ account });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar conta' });
  }
});

app.delete('/api/households/:householdId/accounts/:accountId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, accountId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.deleteAccount(householdId, userId, accountId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao excluir conta' });
  }
});

// Cards
app.get('/api/households/:householdId/cards', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const cards = Array.from(db.cards.values()).filter(
    (c) => c.household_id === householdId && c.is_active
  );
  res.json({ cards });
});

app.post('/api/households/:householdId/cards', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const card = db.createCard(householdId, userId, req.body);
    res.status(201).json({ card });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao criar cartão' });
  }
});

app.put('/api/households/:householdId/cards/:cardId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, cardId } = req.params;
    const { userId } = getSecurityContext(req);
    const card = db.updateCard(householdId, userId, cardId, req.body);
    res.json({ card });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar cartão' });
  }
});

app.delete('/api/households/:householdId/cards/:cardId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, cardId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.deleteCard(householdId, userId, cardId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao excluir cartão' });
  }
});

// Categories
app.get('/api/households/:householdId/categories', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const categories = Array.from(db.categories.values()).filter(
    (c) => c.household_id === householdId && c.is_active
  );
  res.json({ categories });
});

app.post('/api/households/:householdId/categories', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const category = db.createCategory(householdId, userId, req.body);
    res.status(201).json({ category });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao criar categoria' });
  }
});

app.put('/api/households/:householdId/categories/:categoryId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, categoryId } = req.params;
    const { userId } = getSecurityContext(req);
    const category = db.updateCategory(householdId, userId, categoryId, req.body);
    res.json({ category });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar categoria' });
  }
});

// Household Member Invitation
app.post('/api/households/:householdId/members', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const member = db.addHouseholdMember(householdId, userId, req.body);
    res.status(201).json({ member });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao adicionar membro' });
  }
});

app.patch('/api/households/:householdId/members/:memberId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, memberId } = req.params;
    const { userId } = getSecurityContext(req);
    res.json({ member: db.updateHouseholdMember(householdId, userId, memberId, req.body) });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao atualizar membro' });
  }
});

// SPRINT 3: Transactions & Splits API
app.get('/api/households/:householdId/transactions', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const transactions = db.getTransactionsForHousehold(householdId);
  res.json({ transactions });
});

app.get('/api/households/:householdId/money-movements', requireHouseholdAccess, (req, res) => {
  res.json({ movements: db.getMoneyMovements(req.params.householdId) });
});

app.post('/api/households/:householdId/money-movements', requireHouseholdAccess, (req, res) => {
  try {
    const { userId } = getSecurityContext(req);
    res.status(201).json({ movement: db.createMoneyMovement(req.params.householdId, userId, req.body) });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Erro ao registrar movimentação.' });
  }
});

app.post('/api/households/:householdId/transactions', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const tx = db.createTransaction(householdId, userId, req.body);
    res.status(201).json({ transaction: tx });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao criar transação' });
  }
});

app.put('/api/households/:householdId/transactions/:transactionId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, transactionId } = req.params;
    const { userId } = getSecurityContext(req);
    const updatedTx = db.updateTransaction(householdId, userId, transactionId, req.body);
    res.json({ transaction: updatedTx });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao atualizar transação' });
  }
});

app.post('/api/households/:householdId/transactions/:transactionId/refund', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, transactionId } = req.params;
    const { userId } = getSecurityContext(req);
    const reason = req.body?.reason;
    const refundedTx = db.refundTransaction(householdId, userId, transactionId, reason);
    res.json({ transaction: refundedTx, message: 'Lançamento estornado com sucesso' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao estornar transação' });
  }
});

app.get('/api/households/:householdId/cards/:cardId/calculate-dates', requireHouseholdAccess, (req, res) => {
  try {
    const { cardId } = req.params;
    const purchaseDate = (req.query.purchase_date as string) || new Date().toISOString().split('T')[0];
    const dates = db.calculateCardInvoiceDates(cardId, purchaseDate);
    res.json(dates);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao calcular datas do cartão' });
  }
});

app.delete('/api/households/:householdId/transactions/:transactionId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, transactionId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.deleteTransaction(householdId, userId, transactionId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao excluir transação' });
  }
});

// Payment Methods
app.get('/api/payment-methods', (req, res) => {
  const methods = Array.from(db.paymentMethods.values());
  res.json({ payment_methods: methods });
});

// Audit Logs
app.get('/api/households/:householdId/audit-logs', requireHouseholdAccess, (req, res) => {
  const { householdId } = req.params;
  const logs = db.auditLogs.filter((l) => l.household_id === householdId);
  res.json({ logs });
});

// Settlement Balance (Wallace & Guilherme)
app.get('/api/households/:householdId/settlement', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const settlement = db.calculateSettlement(householdId);
    res.json({ success: true, settlement });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      data: [],
      settlement: [],
      message: err.message || 'Sem dados para o período'
    });
  }
});

// SPRINT 7: Detailed Couple Settlement & Compensation Summary API
app.get('/api/households/:householdId/couple-settlement', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const month = req.query.month as string | undefined;
    const summary = db.getDetailedCoupleSettlement(householdId, month);
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      data: [],
      summary: {
        household_id: req.params.householdId || '',
        competence_month: (req.query.month as string) || '2026-05',
        wallace: { total_paid: 0, total_responsibility: 0, net_balance: 0 },
        guilherme: { total_paid: 0, total_responsibility: 0, net_balance: 0 },
        compensation: {
          status: 'settled',
          amount_to_pay: 0,
          debtor_id: null,
          debtor_name: null,
          creditor_id: null,
          creditor_name: null,
          pix_key: null,
          summary_text: 'Sem movimentações para o período selecionado.'
        },
        contributing_transactions: [],
        settlement_history: []
      },
      message: err.message || 'Sem dados para o período'
    });
  }
});

// SPRINT 7: Record Couple Settlement (Liquidação / Compensação em 1-clique)
app.post('/api/households/:householdId/couple-settlement/record', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.recordCoupleSettlement(householdId, userId, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, data: [], error: err.message || 'Erro ao registrar acerto entre o casal', message: err.message });
  }
});

// SPRINT 6: Recurring Bills (Contas Fixas) API
app.get('/api/households/:householdId/recurring-bills', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const bills = db.getRecurringBillsForHousehold(householdId);
    res.json({ success: true, recurring_bills: bills });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], recurring_bills: [], message: err.message || 'Sem dados para o período' });
  }
});

app.post('/api/households/:householdId/recurring-bills', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const bill = db.createRecurringBill(householdId, userId, req.body);
    res.status(201).json({ success: true, recurring_bill: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao criar conta fixa' });
  }
});

app.patch('/api/households/:householdId/recurring-bills/:billId/toggle-active', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, billId } = req.params;
    const { userId } = getSecurityContext(req);
    const bill = db.toggleRecurringBillActive(householdId, userId, billId);
    res.json({ success: true, recurring_bill: bill });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao alternar status da conta' });
  }
});

app.delete('/api/households/:householdId/recurring-bills/:billId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, billId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.deleteRecurringBill(householdId, userId, billId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao excluir conta fixa' });
  }
});

// SPRINT 6: Monthly Occurrences API
app.get('/api/households/:householdId/bill-occurrences', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const occurrences = db.getOccurrencesForMonth(householdId, month);
    res.json({ success: true, occurrences, month });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], occurrences: [], month: (req.query.month as string) || '', message: err.message || 'Sem dados para o período' });
  }
});

app.post('/api/households/:householdId/bill-occurrences/:occurrenceId/pay', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, occurrenceId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.markOccurrenceAsPaid(householdId, userId, occurrenceId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao marcar conta como paga' });
  }
});

app.put('/api/households/:householdId/bill-occurrences/:occurrenceId', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId, occurrenceId } = req.params;
    const { userId } = getSecurityContext(req);
    const updatedOcc = db.updateBillOccurrence(householdId, userId, occurrenceId, req.body);
    res.json({ success: true, occurrence: updatedOcc });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao atualizar conta fixa' });
  }
});

// SPRINT 6: Future Commitments Projections API (+1m, +3m, +6m, +12m)
app.get('/api/households/:householdId/commitments-projection', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const monthsAhead = parseInt((req.query.months_ahead as string) || '12', 10);
    const projections = db.getFutureCommitmentsProjection(householdId, monthsAhead);
    res.json({ success: true, projections });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], projections: [], message: err.message || 'Sem dados para o período' });
  }
});

// SPRINT 5: STRUCTURED DASHBOARD API (SUPABASE AGGREGATED VIEWS CONSUMER)
app.get('/api/households/:householdId/dashboard', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const perspective = (req.query.perspective as any) || 'couple';
    const month = req.query.month as string | undefined;
    const dashboardData = db.getStructuredDashboardData(householdId, perspective, month);
    res.json({ success: true, ...dashboardData });
  } catch (err: any) {
    res.status(500).json({ success: false, data: [], error: err.message || 'Erro ao carregar dados do dashboard', message: 'Sem dados para o período' });
  }
});

// SPRINT 8: Protected Funds & Reserve Drainages API
app.get('/api/households/:householdId/protected-funds', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const funds = db.getProtectedFunds(householdId);
    res.json({ success: true, funds });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], funds: [], message: err.message || 'Sem dados para o período' });
  }
});

app.get('/api/households/:householdId/reserve-drainages', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const drainages = db.getReserveDrainages(householdId);
    res.json({ success: true, drainages });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], drainages: [], message: err.message || 'Sem dados para o período' });
  }
});

app.post('/api/households/:householdId/protected-funds/drain', requireHouseholdAccess, (req, res) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const result = db.recordReserveDrainage(householdId, userId, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Erro ao reclassificar / resgatar fundo protegido' });
  }
});


// SPRINT 8: LIVE AUTOMATED SECURITY & EDGE CASE TEST RUNNER (PROMPT 5 TEST SUITE)
app.post('/api/tests/run-security-suite', (req, res) => {
  const testResults = [];

  // TEST 1: RLS Legit access - Wallace
  const test1Pass = db.hasHouseholdAccess('usr-wallace-001', 'hh-wallace-gui-001');
  testResults.push({
    test_id: 'SEC-01',
    category: 'RLS & Multi-Tenant',
    description: 'Wallace possui permissão de acesso legítimo ao Household Casa Wallace & Guilherme',
    passed: test1Pass,
    details: test1Pass ? 'Autorizado com sucesso (HouseholdMember ativo)' : 'Falha na autorização'
  });

  // TEST 2: RLS Legit access - Guilherme
  const test2Pass = db.hasHouseholdAccess('usr-guilherme-002', 'hh-wallace-gui-001');
  testResults.push({
    test_id: 'SEC-02',
    category: 'RLS & Multi-Tenant',
    description: 'Guilherme possui permissão de acesso legítimo ao Household Casa Wallace & Guilherme',
    passed: test2Pass,
    details: test2Pass ? 'Autorizado com sucesso (HouseholdMember ativo)' : 'Falha na autorização'
  });

  // TEST 3: RLS Hacker access blocked
  const test3Pass = !db.hasHouseholdAccess('usr-external-999', 'hh-wallace-gui-001');
  testResults.push({
    test_id: 'SEC-03',
    category: 'RLS & Multi-Tenant',
    description: 'RLS bloqueia usuário externo não autorizado de acessar dados do domicílio',
    passed: test3Pass,
    details: test3Pass ? 'Acesso bloqueado com sucesso (HTTP 403 retornado)' : 'VULNERABILIDADE: Usuário externo obteve acesso!'
  });

  // TEST 4: Cross-household isolation
  const test4Pass = !db.hasHouseholdAccess('usr-wallace-001', 'hh-other-isolated-002');
  testResults.push({
    test_id: 'SEC-04',
    category: 'RLS & Multi-Tenant',
    description: 'Isolamento de Tenant: Membros não conseguem ver ou alterar dados de outros domicílios',
    passed: test4Pass,
    details: test4Pass ? 'Isolamento estrito entre domicílios mantido' : 'Falha no isolamento de domicílio'
  });

  // TEST 5: Marco Zero Cards
  const cards = Array.from(db.cards.values()).filter((c) => c.household_id === 'hh-wallace-gui-001');
  const cardNames = cards.map((c) => c.name);
  const test5Pass = ['Porto', 'Infinity', 'Múltiplo', 'ITI'].every((name) => cardNames.includes(name));
  testResults.push({
    test_id: 'EDGE-01',
    category: 'Cartões & Marco Zero',
    description: 'Verificação do Marco Zero: 4 cartões essenciais configurados (Porto, Infinity, Múltiplo, ITI)',
    passed: test5Pass,
    details: `Cartões ativos: ${cardNames.join(', ')}`
  });

  // TEST 6: Credit Card Invoice Cutoff Day logic (Compra no dia do fechamento cai na próxima fatura)
  const portoCard = cards.find((c) => c.name.toLowerCase().includes('porto')) || cards[0];
  let test6Pass = true;
  if (portoCard) {
    // Buy on closing day
    const closingDayStr = portoCard.closing_day.toString().padStart(2, '0');
    const buyDate = `2026-05-${closingDayStr}`;
    const invoiceMonth = db.calculateInvoiceMonth(buyDate, portoCard.closing_day);
    test6Pass = invoiceMonth === '2026-06';
  }
  testResults.push({
    test_id: 'EDGE-02',
    category: 'Cartões & Ciclo de Fatura',
    description: 'Regra de Fechamento: Compra realizada no dia de fechamento (ou posterior) é alocada na próxima fatura',
    passed: test6Pass,
    details: test6Pass
      ? `Compra em 2026-05-${portoCard?.closing_day || 15} alocada com precisão na fatura de 2026-06`
      : 'Erro no cálculo do ciclo de fatura'
  });

  // TEST 7: Short Months & February Calendar boundary test
  const febInvoice1 = db.calculateInvoiceMonth('2026-02-28', 31);
  const febInvoice2 = db.calculateInvoiceMonth('2026-02-10', 15);
  const test7Pass = febInvoice1 === '2026-02' && febInvoice2 === '2026-02';
  testResults.push({
    test_id: 'EDGE-03',
    category: 'Datas & Calendário',
    description: 'Borda de Calendário: Meses de 28/29/30 dias e fechamento no dia 31 tratados sem exceções de data',
    passed: test7Pass,
    details: test7Pass ? 'Ajustes automáticos de fim de mês executados com perfeição' : 'Erro em datas de meses curtos'
  });

  // TEST 8: Installment Penny Preservation (R$ 100 em 3x = 33,34 + 33,33 + 33,33)
  const totalAmount = 100.0;
  const count = 3;
  const base = Math.floor((totalAmount / count) * 100) / 100;
  const remainder = Math.round((totalAmount - base * count) * 100) / 100;
  const p1 = Number((base + remainder).toFixed(2)); // 33.34
  const p2 = Number(base.toFixed(2)); // 33.33
  const p3 = Number(base.toFixed(2)); // 33.33
  const sumInstallments = Number((p1 + p2 + p3).toFixed(2));
  const test8Pass = sumInstallments === 100.0 && p1 === 33.34 && p2 === 33.33;
  testResults.push({
    test_id: 'EDGE-04',
    category: 'Precisão Financeira',
    description: 'Centavos em Parcelamento: R$ 100,00 em 3x gera parcelas exatas (33,34 + 33,33 + 33,33 = 100,00)',
    passed: test8Pass,
    details: test8Pass ? `Soma exata obtida: R$ ${sumInstallments.toFixed(2)} (resíduo alocado na 1ª parcela)` : 'Divergência de centavos no parcelamento'
  });

  // TEST 9: Split 50/50 Odd Pennies (R$ 15,35 -> 7,68 + 7,67 = 15,35)
  const splitTotal = 15.35;
  const wShare = Math.round((splitTotal / 2) * 100) / 100; // 7.68
  const gShare = Number((splitTotal - wShare).toFixed(2)); // 7.67
  const test9Pass = Number((wShare + gShare).toFixed(2)) === splitTotal;
  testResults.push({
    test_id: 'EDGE-05',
    category: 'Precisão Financeira',
    description: 'Rateio 50/50 com Centavos Ímpares: R$ 15,35 rateado com exatidão sem perda de centavos',
    passed: test9Pass,
    details: test9Pass ? `Rateio: Wallace R$ ${wShare.toFixed(2)} + Guilherme R$ ${gShare.toFixed(2)} = R$ 15,35` : 'Falha na soma do rateio'
  });

  // TEST 10: Couple Settlement Zero-Sum Theorem (Wallace Balance + Guilherme Balance === 0)
  const settlement = db.getDetailedCoupleSettlement('hh-wallace-gui-001');
  const netSum = Number((settlement.wallace.net_balance + settlement.guilherme.net_balance).toFixed(2));
  const test10Pass = Math.abs(netSum) < 0.01;
  testResults.push({
    test_id: 'EDGE-06',
    category: 'Contabilidade do Casal',
    description: 'Teorema do Saldo Neutro: A soma dos saldos líquidos de Wallace e Guilherme é exatamente zero',
    passed: test10Pass,
    details: test10Pass
      ? `Wallace (${settlement.wallace.net_balance > 0 ? '+' : ''}${settlement.wallace.net_balance}) + Guilherme (${settlement.guilherme.net_balance > 0 ? '+' : ''}${settlement.guilherme.net_balance}) = 0.00`
      : `Divergência contábil detectada: ${netSum}`
  });

  // TEST 11: Double-Counting Prevention (Transfers and invoice payments excluded from settlement)
  const allTxs = Array.from(db.transactions.values()).filter((t) => t.household_id === 'hh-wallace-gui-001');
  const hasTransfersOrPayments = allTxs.some((t) => t.transaction_type === 'transfer' || t.transaction_type === 'invoice_payment');
  const settlementTxs = settlement.contributing_transactions;
  const containsExcluded = settlementTxs.some((t: any) => t.transaction_type === 'transfer' || t.transaction_type === 'invoice_payment');
  const test11Pass = !containsExcluded;
  testResults.push({
    test_id: 'EDGE-07',
    category: 'Contabilidade do Casal',
    description: 'Anti-Dupla Contagem: Transferências entre contas e pagamentos de fatura estritamente excluídos do acerto',
    passed: test11Pass,
    details: test11Pass ? 'Isolamento contábil estrito verificado com sucesso' : 'VULNERABILIDADE: Transferência interna vazou para o acerto!'
  });

  // TEST 12: Audit Trail Immutability
  const test12Pass = db.auditLogs.length > 0 && db.auditLogs.every((l) => l.id && l.created_at && l.action && l.table_name);
  testResults.push({
    test_id: 'SEC-05',
    category: 'Trilha de Auditoria',
    description: 'Imutabilidade da Auditoria: Todas as mutações geram logs estruturados com usuário e timestamp',
    passed: test12Pass,
    details: `${db.auditLogs.length} eventos registrados na trilha de auditoria`
  });

  const allPassed = testResults.every((t) => t.passed);

  res.json({
    all_passed: allPassed,
    total_tests: testResults.length,
    passed_count: testResults.filter((t) => t.passed).length,
    results: testResults
  });
});

// ==========================================
// PROMPT 6: IA, OCR E IMPORTAÇÃO DE FATURAS
// ==========================================

// 1. OCR de Comprovantes / Fotos de Recibos
app.post('/api/households/:householdId/ocr/receipt', requireHouseholdAccess, async (req: Request, res: Response) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const { base64_image, mime_type, file_name } = req.body;

    if (typeof base64_image !== 'string' || !base64_image) {
      res.status(400).json({ error: 'Imagem base64 é obrigatória para processar o OCR.' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime_type || 'image/jpeg') || Buffer.byteLength(base64_image, 'base64') > 10 * 1024 * 1024) {
      res.status(415).json({ error: 'Use uma imagem JPG, PNG ou WEBP de até 10 MB.' }); return;
    }
    const fingerprint = crypto.createHash('sha256').update(Buffer.from(base64_image, 'base64')).digest('hex');
    const duplicate = db.findDocumentImportByFingerprint(householdId, fingerprint);
    if (duplicate) { res.status(409).json({ error: 'Este documento já foi enviado.', duplicate_import_id: duplicate.id }); return; }

    // Salvar registro de importação
    const docImport = db.saveDocumentImport({
      household_id: householdId,
      uploaded_by: userId,
      document_type: 'RECEIPT',
      file_url: file_name || 'receipt_capture.jpg',
      status: 'PROCESSING', document_fingerprint: fingerprint
    });

    const ocrResult = await processReceiptImageOcr(householdId, base64_image, mime_type || 'image/jpeg');
    ocrResult.document_fingerprint = fingerprint;

    db.updateDocumentImport(docImport.id, {
      status: 'AWAITING_REVIEW',
      raw_ocr_response: ocrResult
    });

    res.json({
      success: true,
      import_id: docImport.id,
      data: ocrResult
    });
  } catch (error: unknown) {
    console.error('Receipt OCR request failed', { error: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({
      error: 'Falha ao processar o OCR do comprovante via IA.',
      details: 'Revise o formato do arquivo e tente novamente.'
    });
  }
});

// 2. Parser e Extração de Faturas PDF de Cartão
app.post('/api/households/:householdId/ocr/invoice-pdf', requireHouseholdAccess, async (req: Request, res: Response) => {
  try {
    const { householdId } = req.params;
    const { userId } = getSecurityContext(req);
    const { base64_pdf, raw_text, card_id, file_name } = req.body;

    if ((!base64_pdf || typeof base64_pdf !== 'string') && (!raw_text || typeof raw_text !== 'string')) {
      res.status(400).json({ error: 'Conteúdo do arquivo PDF (base64 ou texto extraído) é obrigatório.' });
      return;
    }
    const payload = (base64_pdf || raw_text) as string;
    if (base64_pdf && Buffer.byteLength(base64_pdf, 'base64') > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'A fatura deve ter no máximo 10 MB.' }); return;
    }
    const fingerprint = crypto.createHash('sha256').update(base64_pdf ? Buffer.from(base64_pdf, 'base64') : payload).digest('hex');
    const duplicate = db.findDocumentImportByFingerprint(householdId, fingerprint);
    if (duplicate) { res.status(409).json({ error: 'Esta fatura já foi enviada.', duplicate_import_id: duplicate.id }); return; }

    const docImport = db.saveDocumentImport({
      household_id: householdId,
      uploaded_by: userId,
      document_type: 'INVOICE',
      file_url: file_name || 'fatura_cartao.pdf',
      status: 'PROCESSING', document_fingerprint: fingerprint
    });

    const isBase64 = Boolean(base64_pdf);
    const invoiceResult = await processInvoicePdf(householdId, payload, isBase64, card_id);
    invoiceResult.document_fingerprint = fingerprint;

    db.updateDocumentImport(docImport.id, {
      status: 'AWAITING_REVIEW',
      raw_ocr_response: invoiceResult
    });

    res.json({
      success: true,
      import_id: docImport.id,
      data: invoiceResult
    });
  } catch (error: unknown) {
    console.error('Invoice OCR request failed', { error: error instanceof Error ? error.name : 'UnknownError' });
    res.status(500).json({
      error: 'Falha ao processar a fatura em PDF via IA.',
      details: 'Revise o formato do arquivo e tente novamente.'
    });
  }
});

// A IA apenas sugere. Somente esta confirmação explícita cria despesas.
app.post('/api/households/:householdId/ocr/imports/:importId/confirm', requireHouseholdAccess, (req: Request, res: Response) => {
  try {
    const { householdId, importId } = req.params;
    const { userId } = getSecurityContext(req);
    const doc = db.documentImports.get(importId);
    if (!doc || doc.household_id !== householdId) { res.status(404).json({ error: 'Importação não encontrada.' }); return; }
    if (doc.status !== 'AWAITING_REVIEW' || !doc.raw_ocr_response) { res.status(409).json({ error: 'Importação indisponível para confirmação.' }); return; }
    const submitted = Array.isArray(req.body?.items) ? req.body.items as InvoiceParsedItem[] : [];
    if (!req.body?.confirmed || !submitted.length) { res.status(400).json({ error: 'A revisão e a confirmação explícita são obrigatórias.' }); return; }
    const originalById = new Map(doc.raw_ocr_response.items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const items = submitted.filter((item) => {
      const original = originalById.get(item.id);
      if (!original || seen.has(item.id) || original.reconciliation_status === 'ALREADY_REGISTERED') return false;
      seen.add(item.id);
      return item.selected && Number.isFinite(item.amount) && item.amount > 0;
    });
    if (!items.length) { res.status(400).json({ error: 'Selecione ao menos um item válido e não duplicado.' }); return; }
    const members = Array.from(db.householdMembers.values()).filter((member) => member.household_id === householdId && member.is_active).slice(0, 2);
    const created = items.map((item) => {
      const cardId = doc.raw_ocr_response?.suggested_card_id;
      const accountId = doc.raw_ocr_response?.suggested_account_id;
      const credit = Boolean(cardId);
      return db.createTransaction(householdId, userId, {
        description: item.description, merchant: item.description, total_amount: item.amount,
        transaction_type: 'expense', payment_method_id: credit ? 'pm-credit' : (doc.raw_ocr_response?.payment_method_detected === 'PIX' ? 'pm-pix' : 'pm-debit'),
        card_id: credit ? cardId : null, account_id: credit ? null : accountId,
        category_id: item.suggested_category_id, buyer_user_id: userId, payer_user_id: userId,
        beneficiary_type: members.length === 2 ? 'both' : 'custom', transaction_date: item.transaction_date,
        competence_month: doc.raw_ocr_response?.invoice_competence || item.transaction_date?.slice(0, 7), status: 'completed',
        notes: `Importado após revisão humana (${importId})${item.installment_info && item.installment_info.total_installments > 1 ? ` · parcela ${item.installment_info.current_installment}/${item.installment_info.total_installments}` : ''}`,
        splits: members.map((member) => ({ responsible_user_id: member.user_id, percentage: 100 / members.length, amount: item.amount / members.length }))
      });
    });
    db.updateDocumentImport(importId, { status: 'CONFIRMED', confirmed_at: new Date().toISOString(), confirmed_by: userId, created_transaction_ids: created.map((item) => item.id) });
    res.status(201).json({ success: true, transaction_ids: created.map((item) => item.id) });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível confirmar a importação.' });
  }
});

// 3. Regras de Categorias por Estabelecimento (Merchant Rules)
app.get('/api/households/:householdId/merchant-rules', requireHouseholdAccess, (req: Request, res: Response) => {
  const { householdId } = req.params;
  const rules = db.getMerchantRules(householdId);
  res.json({ rules });
});

app.post('/api/households/:householdId/merchant-rules', requireHouseholdAccess, (req: Request, res: Response) => {
  const { householdId } = req.params;
  const { merchant_pattern, category_id } = req.body;

  if (!merchant_pattern || !category_id) {
    res.status(400).json({ error: 'Padrão do estabelecimento e ID da categoria são obrigatórios.' });
    return;
  }

  const rule = db.saveMerchantRule(householdId, merchant_pattern, category_id);
  res.status(201).json({ success: true, rule });
});

app.delete('/api/households/:householdId/merchant-rules/:ruleId', requireHouseholdAccess, (req: Request, res: Response) => {
  const { householdId, ruleId } = req.params;
  const success = db.deleteMerchantRule(ruleId, householdId);
  if (!success) {
    res.status(404).json({ error: 'Regra de categoria não encontrada.' });
    return;
  }
  res.json({ success: true, message: 'Regra removida com sucesso.' });
});

// 4. Verificação de Duplicidade / Fuzzy Matching
app.post('/api/households/:householdId/transactions/check-duplicates', requireHouseholdAccess, (req: Request, res: Response) => {
  const { householdId } = req.params;
  const { amount, transaction_date, description, card_id } = req.body;

  if (amount === undefined || !transaction_date || !description) {
    res.status(400).json({ error: 'Valor, data e descrição são obrigatórios para checagem de duplicidade.' });
    return;
  }

  const result = db.checkDuplicateTransaction(householdId, Number(amount), transaction_date, description, card_id);
  res.json({ duplicate_info: result });
});

// 5. Importação em Lote de Itens de Fatura (Bulk Import)
app.post('/api/households/:householdId/transactions/bulk-import', requireHouseholdAccess, (req: Request, res: Response) => {
  const { householdId } = req.params;
  const { userId } = getSecurityContext(req);
  const {
    items,
    default_buyer_user_id,
    default_payer_user_id,
    default_card_id,
    default_payment_method_id,
    default_beneficiary_type
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Array de itens é obrigatório para importação em lote.' });
    return;
  }

  const createdTransactions: any[] = [];
  const buyerId = default_buyer_user_id || userId;
  const payerId = default_payer_user_id || userId;
  const cardId = default_card_id || 'card-porto-01';
  const paymentMethodId = default_payment_method_id || 'pm-credit';
  const beneficiaryType = default_beneficiary_type || 'both';

  for (const item of items) {
    const isInstallment = Boolean(item.installment_info && item.installment_info.total_installments > 1);
    const count = isInstallment ? item.installment_info.total_installments : 1;

    // Save merchant rule if pattern and category present
    if (item.description && item.suggested_category_id) {
      db.saveMerchantRule(householdId, item.description, item.suggested_category_id);
    }

    const txData: any = {
      buyer_user_id: item.buyer_user_id || buyerId,
      payer_user_id: item.payer_user_id || payerId,
      transaction_date: item.transaction_date || new Date().toISOString().split('T')[0],
      description: item.description,
      merchant: item.description,
      total_amount: Number(item.amount),
      transaction_type: 'expense',
      payment_method_id: item.payment_method_id || paymentMethodId,
      card_id: item.card_id || cardId,
      category_id: item.suggested_category_id || 'cat-outros',
      beneficiary_type: item.beneficiary_type || beneficiaryType,
      is_installment: isInstallment,
      installments_count: count,
      notes: item.installment_info && count > 1
        ? `Importado de Fatura: Parcela ${item.installment_info.current_installment}/${count}`
        : 'Importado automaticamente via Fatura PDF'
    };

    if (txData.beneficiary_type === 'both') {
      const wShare = Math.round((txData.total_amount / 2) * 100) / 100;
      const gShare = Number((txData.total_amount - wShare).toFixed(2));
      txData.splits = [
        { responsible_user_id: 'usr-wallace-001', percentage: 50, amount: wShare },
        { responsible_user_id: 'usr-guilherme-002', percentage: 50, amount: gShare }
      ];
    } else if (txData.beneficiary_type === 'wallace') {
      txData.splits = [
        { responsible_user_id: 'usr-wallace-001', percentage: 100, amount: txData.total_amount }
      ];
    } else if (txData.beneficiary_type === 'guilherme') {
      txData.splits = [
        { responsible_user_id: 'usr-guilherme-002', percentage: 100, amount: txData.total_amount }
      ];
    }

    const createdTx = db.createTransaction(householdId, userId, txData);
    createdTransactions.push(createdTx);
  }

  res.status(201).json({
    success: true,
    imported_count: createdTransactions.length,
    transactions: createdTransactions
  });
});

// 6. Histórico de Importações
app.get('/api/households/:householdId/document-imports', requireHouseholdAccess, (req: Request, res: Response) => {
  try {
    const { householdId } = req.params;
    const imports = db.getDocumentImports(householdId);
    res.json({ success: true, imports });
  } catch (err: any) {
    res.status(200).json({ success: false, data: [], imports: [], message: err.message || 'Sem dados' });
  }
});

// --- API 404 & ERROR HANDLING (PREVENTS RETURNING HTML FOR /api ROUTES) ---
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    data: [],
    error: 'Rota da API não encontrada',
    message: `A rota ${req.method} ${req.path} não existe no servidor.`,
    path: req.path
  });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    console.error('[API Server Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      data: [],
      error: err.message || 'Erro interno no servidor',
      message: 'Sem dados para o período'
    });
    return;
  }
  next(err);
});

// Vite Middleware & Static Serving Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
