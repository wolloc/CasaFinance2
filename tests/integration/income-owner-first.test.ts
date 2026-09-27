import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
const resourceChoice=await readFile(new URL('../../src/components/app/FinancialResourceChoice.tsx',import.meta.url),'utf8');

test('Nova Entrada starts from the beneficiary before destination and value',()=>{
 const beneficiary=screen.indexOf('De quem é esta entrada?');
 const destination=screen.indexOf('Onde entrou?');
 const amount=screen.indexOf('>Valor<input');
 assert.ok(beneficiary>=0);
 assert.ok(destination>beneficiary);
 assert.ok(amount>destination);
 assert.match(screen,/autoFocus=\{index===0\}/);
});

test('income destination cards use canonical account ownership',()=>{
 assert.match(screen,/listIncomeDestinationAccounts/);
 assert.match(screen,/account\.owner_member_ids/);
 assert.match(screen,/resource\.ownerMemberIds\.includes\(beneficiaryMemberId\)/);
 assert.match(screen,/Conjunta/);
 assert.match(screen,/Titular/);
 assert.match(screen,/DestinationIcon/);
 assert.match(screen,/institution:account\.institution/);
 assert.match(screen,/institution=\{resource\.institution\}/);
 assert.match(screen,/grid grid-cols-3 gap-2/);
 assert.match(resourceChoice,/min-h-\[58px\]/);
 assert.match(resourceChoice,/aria-pressed=\{active\}/);
 assert.doesNotMatch(screen,/Onde deve entrar\?<select/);
});

test('changing beneficiary drops an incompatible previously selected account',()=>{
 assert.match(screen,/chooseBeneficiary/);
 assert.match(screen,/setPlannedDestinationAccountId\(''\)/);
 assert.match(screen,/Escolha uma conta compatível com a pessoa que recebe esta entrada/);
});

test('known income defaults to confirmed with human language and without pretending it was received',()=>{
 assert.match(screen,/useState<IncomeConfidence>\('confirmed'\)/);
 assert.match(screen,/Essa entrada já está confirmada\?/);
 assert.match(screen,/Sim, já sei que vou receber/);
 assert.match(screen,/Ainda é uma expectativa/);
 assert.match(screen,/Ela só vira recebida quando o dinheiro realmente entrar/);
 assert.match(screen,/saldo só muda quando o recebimento acontecer de verdade/);
 assert.doesNotMatch(screen,/Situação<select/);
});

test('recurring income is created inside the owner-first flow without bypassing destination compatibility',()=>{
 assert.match(screen,/createRecurringIncomeRule/);
 assert.match(screen,/Repetir esta entrada/);
 assert.match(screen,/resource\.ownerMemberIds\.includes\(beneficiaryMemberId\)/);
 assert.match(screen,/plannedDestinationAccountId/);
 assert.match(screen,/A primeira ocorrência é esta entrada/);
});

test('Nova Entrada follows the simplified product order and hides technical income type',()=>{
 const destination=screen.indexOf('Onde entrou?');
 const origin=screen.indexOf('De onde vem?');
 const amount=screen.indexOf('>Valor<input');
 const when=screen.indexOf('Quando?');
 const category=screen.indexOf('Categoria');
 const confirmation=screen.indexOf('Essa entrada já está confirmada?');
 assert.ok(destination>=0&&origin>destination&&amount>origin&&when>amount&&category>when&&confirmation>category);
 assert.doesNotMatch(screen,/>Tipo<select/);
 assert.match(screen,/const inferredIncomeNature:IncomeNature/);
 assert.match(screen,/return 'other_true_income'/);
});
