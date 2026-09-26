import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');

test('Nova Entrada starts from the beneficiary before destination and value',()=>{
 const beneficiary=screen.indexOf('De quem é esta entrada?');
 const destination=screen.indexOf('Onde deve entrar?');
 const amount=screen.indexOf('>Valor<input');
 assert.ok(beneficiary>=0);
 assert.ok(destination>beneficiary);
 assert.ok(amount>destination);
 assert.match(screen,/autoFocus=\{index===0\}/);
});

test('income destination options use canonical account ownership',()=>{
 assert.match(screen,/listIncomeDestinationAccounts/);
 assert.match(screen,/account\.owner_member_ids/);
 assert.match(screen,/resource\.ownerMemberIds\.includes\(beneficiaryMemberId\)/);
 assert.match(screen,/Conjunta/);
 assert.match(screen,/Titular/);
});

test('changing beneficiary drops an incompatible previously selected account',()=>{
 assert.match(screen,/chooseBeneficiary/);
 assert.match(screen,/setPlannedDestinationAccountId\(''\)/);
 assert.match(screen,/Escolha uma conta compatível com a pessoa que recebe esta entrada/);
});

test('known income defaults to confirmed without pretending it was received',()=>{
 assert.match(screen,/useState<IncomeConfidence>\('confirmed'\)/);
 assert.match(screen,/Confirmada significa que a entrada é conhecida; não significa recebida/);
 assert.match(screen,/saldo só muda quando o recebimento acontecer de verdade/);
});

test('this package does not redefine recurring income',()=>{
 assert.doesNotMatch(screen,/createRecurringIncomeRule|RecurringIncomeFrequency/);
});
