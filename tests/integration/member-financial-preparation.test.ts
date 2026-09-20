import test from 'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';
const app=await readFile(new URL('../../src/App.tsx',import.meta.url),'utf8');const screen=await readFile(new URL('../../src/components/auth/MemberFinancialPreparation.tsx',import.meta.url),'utf8');const migration=await readFile(new URL('../../supabase/migrations/202609200101_member_financial_preparation_gate.sql',import.meta.url),'utf8');
test('member preparation blocks financial app until explicit completion',()=>{assert.match(app,/!currentMember\.financial_onboarding_completed_at/);assert.match(app,/<MemberFinancialPreparation/);assert.match(migration,/complete_my_financial_onboarding/);});
test('preparation lets member add resources or continue without inventing data',()=>{assert.match(screen,/Adicionar meus recursos/);assert.match(screen,/Não tem nada para adicionar agora\?/);assert.match(screen,/Concluir e entrar no Casa/);assert.doesNotMatch(migration,/transactions|money_movements|funding_events|account_balance_events/);});
test('preparation explains existing household resources are not reconciled again',()=>{assert.match(screen,/Você não precisa revisar nem confirmar saldos de outra pessoa/);assert.match(screen,/memberOnboarding/);});


test('preparation blocks invited member while the household baseline is unresolved',()=>{
 assert.match(screen,/getHouseholdFinancialSetupReadiness/);
 assert.match(screen,/A posição inicial da Casa ainda está sendo concluída/);
 assert.match(screen,/Você não precisa revisar saldos ou recursos de outra pessoa/);
 assert.match(screen,/Conferir novamente/);
});

test('owner receives the first-household preparation instead of invited-member copy',()=>{
 assert.match(screen,/Vamos montar o ponto de partida da sua Casa/);
 assert.match(screen,/HouseholdFinancialSetup memberOnboarding=\{!isOwner\}/);
 assert.match(screen,/Revisar posição inicial/);
});
