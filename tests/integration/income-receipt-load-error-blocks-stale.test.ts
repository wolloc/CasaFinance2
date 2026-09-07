import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/IncomeReceiptAction.tsx',import.meta.url),'utf8');
test('failed load clears stale income and account context',()=>{assert.match(source,/const clearLoadedContext=\(\)=>\{[\s\S]*?setIncomes\(\[\]\)[\s\S]*?setAccounts\(\[\]\)[\s\S]*?setTransactionId\(''\)[\s\S]*?setDestinationAccountId\(''\)/);assert.match(source,/catch\{\s*clearLoadedContext\(\);/);});
test('load error hides the receipt form and offers retry',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: incomes\.length === 0/);});
test('receipt submit refuses stale load context before financial mutation',()=>{assert.match(source,/if \(loadError\) \{ setError\('Recarregue os dados antes de registrar um recebimento\.'\); return; \}/);const beforeSettle=source.split('await settleHouseholdIncome')[0];assert.match(beforeSettle,/if \(loadError\)/);});
