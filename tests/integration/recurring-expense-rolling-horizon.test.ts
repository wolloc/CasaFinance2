import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { recurringExpenseRollingHorizonDate } from '../../src/finance/recurringExpenses.ts';

const home = await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');

test('rolling horizon stays one calendar year ahead without overflowing leap day', () => {
  assert.equal(recurringExpenseRollingHorizonDate('2026-09-13'), '2027-09-13');
  assert.equal(recurringExpenseRollingHorizonDate('2028-02-29'), '2029-02-28');
  assert.throws(() => recurringExpenseRollingHorizonDate('2026-02-30'), /Data de referência/);
});

test('home refreshes recurring projections before reading the financial dashboard', () => {
  const ensureIndex = home.indexOf('await ensureRecurringExpenseHorizon');
  const dashboardIndex = home.indexOf('await getFinancialDashboard');
  assert.ok(ensureIndex >= 0, 'CasaHomeScreen must extend the recurring horizon');
  assert.ok(dashboardIndex > ensureIndex, 'dashboard must be read only after recurrence projections are extended');
  assert.match(home, /recurringExpenseRollingHorizonDate\(dateInTimeZone\(household\.timezone\)\)/);
});
