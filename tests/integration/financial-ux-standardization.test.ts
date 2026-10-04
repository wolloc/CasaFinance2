import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const home=fs.readFileSync(path.join(root,'src/components/app/HomeFinancialMap.tsx'),'utf8');
const expenses=fs.readFileSync(path.join(root,'src/components/app/ExpenseMonthBrowser.tsx'),'utf8');
const transactions=fs.readFileSync(path.join(root,'src/components/app/TransactionsScreen.tsx'),'utf8');

test('Casa classifica contas pela natureza do recurso',()=>{
  assert.match(home,/\['checking','savings'\]\.includes\(item\.type\)/);
  assert.match(home,/\['cash','digital_wallet'\]\.includes\(item\.type\)/);
});

test('Gastos prioriza a parte do membro e mantém o valor original discreto',()=>{
  assert.match(expenses,/selectedMember\?'Sua parte'/);
  assert.match(expenses,/row\.installment_number\?'Parcela'/);
  assert.match(expenses,/valor original/);
});

test('ações de detalhe propagam refresh financeiro',()=>{
  assert.match(transactions,/DirectExpensePaymentAction[\s\S]*onCompleted=\{onFinancialChange\}/);
  assert.match(transactions,/ExternalExpensePaymentAction[\s\S]*onCompleted=\{onFinancialChange\}/);
  assert.match(transactions,/ExpenseRoleCorrectionAction[\s\S]*onCompleted=\{onFinancialChange\}/);
  assert.match(transactions,/CardRefundAction[\s\S]*onCompleted=\{onFinancialChange\}/);
});
