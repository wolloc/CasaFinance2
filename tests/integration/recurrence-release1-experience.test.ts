import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/upcomingFinancialEvents.ts',import.meta.url),'utf8');
const upcoming=await readFile(new URL('../../src/components/app/UpcomingFinancialEvents.tsx',import.meta.url),'utf8');
const management=await readFile(new URL('../../src/components/app/RecurringExpenseManagement.tsx',import.meta.url),'utf8');

test('normal recurring commitments stay visible in upcoming events',()=>{
 assert.match(service,/is_recurring:row\.source_type==='recurring_occurrence'/);
 assert.match(upcoming,/item\.is_recurring/);
 assert.match(upcoming,/>Recorrente</);
});

test('expense recurrence management uses human language and exposes next occurrence and ending',()=>{
 assert.match(management,/Gastos que se repetem/);
 assert.match(management,/Mudar próximos meses/);
 assert.match(management,/Parar recorrência/);
 assert.match(management,/Próxima ·/);
 assert.match(management,/Até você parar/);
 assert.match(management,/Termina ·/);
 assert.doesNotMatch(management,/>Alterar futuro</);
 assert.doesNotMatch(management,/>Criar nova versão</);
});
