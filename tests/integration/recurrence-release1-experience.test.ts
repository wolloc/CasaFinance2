import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const service=await readFile(new URL('../../src/finance/upcomingFinancialEvents.ts',import.meta.url),'utf8');
const upcoming=await readFile(new URL('../../src/components/app/UpcomingFinancialEvents.tsx',import.meta.url),'utf8');
const management=await readFile(new URL('../../src/components/app/RecurringExpenseManagement.tsx',import.meta.url),'utf8');
const incomeManagement=await readFile(new URL('../../src/components/app/RecurringIncomeManagement.tsx',import.meta.url),'utf8');

test('normal recurring commitments stay visible in upcoming events',()=>{
 assert.match(service,/is_recurring:row\.source_type==='recurring_occurrence'/);
 assert.match(upcoming,/item\.is_recurring/);
 assert.match(upcoming,/>Recorrente</);
});

test('recurrence management shares compact mobile language across expense and income',()=>{
 assert.match(management,/Gastos que se repetem/);
 assert.match(management,/Editar próximos/);
 assert.match(management,/Encerrar recorrência/);
 assert.match(management,/Próxima em/);
 assert.match(management,/Termina em/);
 assert.match(incomeManagement,/Entradas que se repetem/);
 assert.match(incomeManagement,/Editar próximos/);
 assert.match(incomeManagement,/Encerrar recorrência/);
 assert.match(incomeManagement,/Salvar próximos/);
 assert.doesNotMatch(management,/>Alterar futuro</);
 assert.doesNotMatch(incomeManagement,/>Criar nova versão</);
});
