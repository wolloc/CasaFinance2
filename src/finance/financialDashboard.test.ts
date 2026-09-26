import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{test}from'node:test';
const serviceSource=await readFile(new URL('./financialDashboard.ts',import.meta.url),'utf8');const screenSource=await readFile(new URL('../components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');const selectorSource=await readFile(new URL('../components/app/FinancialPerspectiveSelector.tsx',import.meta.url),'utf8');const prioritySource=await readFile(new URL('../components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');const settlementHubSource=await readFile(new URL('../components/app/SettlementHub.tsx',import.meta.url),'utf8');const productSpec=await readFile(new URL('../../docs/product-spec-v2.md',import.meta.url),'utf8');
test('Casa home keeps canonical section sequence with priority center in attention slot',()=>{const householdView=screenSource.slice(screenSource.lastIndexOf('return <div className="space-y-7">'));const homeOrder=['Como estamos?','<FinancialPriorityCenter','Mês em resumo','Onde está nosso dinheiro','Cartões','<UpcomingFinancialEvents','O que mais pesou','<SettlementHub','Olhando pra frente'];const indexes=homeOrder.map(label=>householdView.indexOf(label));assert.ok(indexes.every(index=>index>=0));assert.deepEqual([...indexes].sort((a,b)=>a-b),indexes);const specLabels=['Resumo principal','Precisa de atenção','Mês em resumo','Contas e recursos','Cartões','Próximos acontecimentos','Principais categorias','Acertos','Olhando pra frente'];const specIndexes=specLabels.map(label=>productSpec.indexOf(label));assert.ok(specIndexes.every(index=>index>=0));assert.deepEqual([...specIndexes].sort((a,b)=>a-b),specIndexes);assert.match(prioritySource,/Precisa de atenção/);assert.match(settlementHubSource,/Acertos/);});
test('dashboard reads canonical health, prioritized attention and three-month projection',()=>{assert.match(serviceSource,/rpc\('financial_household_health_position'/);assert.match(serviceSource,/from\('financial_projection_confidence_positions'\)/);assert.match(serviceSource,/rpc\('financial_priority_attention_items'/);assert.match(serviceSource,/rpc\('financial_monthly_projection'/);assert.match(serviceSource,/p_horizon_months\s*:\s*3/);assert.match(serviceSource,/rpc\('financial_liquidity_guidance'/);});
test('member selector uses canonical individual projection',()=>{assert.match(screenSource,/FinancialPerspectiveSelector/);assert.match(selectorSource,/Nossa Casa/);assert.match(screenSource,/getMemberFinancialPerspective/);assert.match(serviceSource,/rpc\('financial_member_monthly_projection'/);assert.match(serviceSource,/p_member_id\s*:\s*memberId/);assert.doesNotMatch(screenSource,/available_money\s*\/\s*2|projected_balance\s*\/\s*2/);});
test('individual perspective keeps liquidity responsibility and funding distinct',()=>{for(const value of['Posso movimentar hoje','opening_liquidity','Minha responsabilidade','economic_responsibility_remaining','Pode sair dos meus recursos','projected_funding_remaining','Tenho a receber','settlement_receivable_position'])assert.match(screenSource,new RegExp(value));assert.match(screenSource,/sem misturar comprador, responsabilidade e quem paga/);});
test('failed individual read is not silently replaced',()=>{assert.match(serviceSource,/unattributed_funding_remaining/);assert.match(screenSource,/memberError/);assert.match(screenSource,/Nenhum valor foi substituído por zero/);});
test('Casa separates current free and projected cash',()=>{assert.match(screenSource,/Saldo atual/);assert.match(screenSource,/Livre depois deles/);assert.match(screenSource,/Deve sobrar/);assert.match(screenSource,/health\?\.current_cash/);assert.match(screenSource,/health\?\.projected_ending_cash/);});
test('monthly indicators use true income and commitments',()=>{for(const value of['realized_true_income_in_month','expected_reliable_income_remaining','realized_commitments_in_month','remaining_commitments_in_month','projected_recurring_commitments','prior_pending_outflow'])assert.match(screenSource,new RegExp(value));});
test('money classes remain separate',()=>{for(const value of['Contas e dinheiro','Benefícios','Reservas','Investimentos'])assert.match(screenSource,new RegExp(value));assert.match(screenSource,/Patrimônio financeiro acompanhado/);});
test('dashboard stays read-only',()=>{assert.doesNotMatch(serviceSource,/\.insert\(|\.update\(|\.delete\(|\.upsert\(/);for(const rpc of['financial_household_health_position','financial_priority_attention_items','financial_monthly_projection','financial_member_monthly_projection','financial_liquidity_guidance'])assert.match(serviceSource,new RegExp(`rpc\\('${rpc}'`));assert.doesNotMatch(serviceSource,/create_financial_transaction|settle_|refund_|correct_|cancel_/);});

test('individual perspective explains liquidity, projected change and household settlement visually',()=>{for(const value of['projected_net_change','Deve sobrar comigo no fim do mês','Acerto entre nós','Tenho a receber','Preciso acertar'])assert.match(screenSource,new RegExp(value));});


test('household forward view keeps considered flows and projected ending cash visible without turning into a report',()=>{
 assert.match(screenSource,/Uma leitura rápida de como o caixa pode fechar nos próximos meses/);
 assert.match(screenSource,/Pode terminar com/);
 assert.match(screenSource,/realized_true_income_in_month/);
 assert.match(screenSource,/expected_reliable_income_remaining/);
 assert.match(screenSource,/remaining_commitments_in_month/);
 assert.match(screenSource,/projected_ending_cash/);
 assert.match(screenSource,/overflow-x-auto/);
});


test('Home resume exposição do cartão e usa o próprio cartão como entrada para Faturas',()=>{
 for(const value of ['Fatura','Futuro','Limite livre','Crédito comprometido'])assert.match(screenSource,new RegExp(value));
 for(const field of ['current_invoice_remaining','future_known_commitments','available_limit','utilization_ratio','over_limit_amount','next_due_date'])assert.match(screenSource,new RegExp(field));
 assert.match(screenSource,/onClick=\{\(\)=>onOpenCard\?\.\(c\.card_id\)\}/);
 assert.doesNotMatch(screenSource,/Todas as faturas/);
 assert.doesNotMatch(screenSource,/Ver cartão e fatura/);
 assert.doesNotMatch(screenSource,/CardFinancialJourney/);
});
test('card utilization bar is visually capped while preserving the real percentage label',()=>{
 assert.match(screenSource,/Math\.round\(usage\)/);
 assert.match(screenSource,/Math\.min\(100,Math\.max\(0,usage\)\)/);
 assert.match(screenSource,/c\.card_health==='red'\?'bg-rose-400'/);
});

test('Casa month navigator opens a real monthly picker instead of resetting on center click',()=>{assert.match(screenSource,/Toque para escolher o mês/);assert.match(screenSource,/Escolher mês da Casa/);assert.match(screenSource,/type="month"/);assert.match(screenSource,/setPeriodPickerOpen\(value=>!value\)/);assert.match(screenSource,/setReferenceMonth\(normalizeReferenceMonth\(event\.target\.value\)\)/);assert.match(screenSource,/Mês atual/);assert.doesNotMatch(screenSource,/onClick=\{\(\)=>setReferenceMonth\(currentReferenceMonth\)\} className="min-h-10 flex-1/);});
