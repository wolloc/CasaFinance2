import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home = await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');
const settlements = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');
const projectionReview = await readFile(new URL('../../src/components/app/ProjectionReviewCenter.tsx', import.meta.url), 'utf8');

test('Home traduz a posição financeira em leitura rápida para leigos',()=>{
  for(const value of ['Agora','Entrou','Ainda entra','Já comprometido','Ainda compromete','Deve sobrar no fim do mês']) assert.match(home,new RegExp(value));
  assert.match(home,/healthText\[health\.health\]/);
  assert.doesNotMatch(home,/confidence\.confidence_label/);
  assert.match(home,/Alguns dados não atualizaram agora/);
});

test('resumo mensal separa o que aconteceu do que ainda vem sem duplicar as listas',()=>{
  for(const value of ['Como estamos?','Entrou','Ainda entra','Já comprometido','Ainda compromete']) assert.match(home,new RegExp(value));
  assert.doesNotMatch(home,/title="Mês em resumo"/);
  assert.match(home,/realized_true_income_in_month/);
  assert.match(home,/expected_reliable_income_remaining/);
  assert.match(home,/realized_commitments_in_month/);
  assert.match(home,/projected_recurring_commitments/);
  assert.doesNotMatch(home,/Quanto das entradas consideradas já chegou/);
  assert.doesNotMatch(home,/Quanto dos compromissos considerados já aconteceu/);
});

test('Home deixa a análise por categorias para Gastos e Entradas',()=>{
  assert.doesNotMatch(home,/listEconomicMonthExpenses/);
  assert.doesNotMatch(home,/FinancialSectionHeading title="O que mais pesou"/);
});

test('posição realizada entre moradores aparece em Como estamos e mantém detalhe na seção de pessoas',()=>{
  assert.match(home,/Entre moradores/);
  assert.match(home,/currentMemberSettlements/);
  assert.match(home,/deve a/);
  assert.match(home,/border-cyan-800\/70 bg-cyan-950\/30/);
  assert.match(home,/text-lg font-black text-cyan-200/);
  assert.match(settlements,/memberPairs/);
  assert.match(settlements,/current\?currentText:'Tudo equilibrado hoje'/);
});


test('projeção futura mostra tendência entre meses comparáveis',()=>{
  assert.match(home,/vs\. mês anterior/);
  assert.match(home,/previousEnding/);
  assert.match(home,/delta=previousEnding===null\?null:ending-previousEnding/);
});

test('Home torna recursos exploráveis e cartões navegáveis sem CTA duplicado dominante',()=>{
  for(const value of ["label:'Contas'","label:'Dinheiro'","label:'Benefícios'","label:'Investimentos'",'Valor acompanhado']) assert.match(home,new RegExp(value));
  assert.match(home,/role="button" tabIndex=\{0\} onClick=\{\(\)=>onOpenCard\?\.\(c\.card_id\)\}/);
  assert.doesNotMatch(home,/Todas as faturas/);
  assert.doesNotMatch(home,/Ver cartão e fatura/);
});

test('Home simplifica recursos sem repetir explicações técnicas',()=>{assert.match(home,/Onde está nosso dinheiro/);assert.match(home,/Valor acompanhado/);assert.doesNotMatch(home,/label:'Dinheiro reservado'/);assert.match(home,/detailLabel:item\.resource_restriction==='reserve'\?'Reserva'/);assert.doesNotMatch(home,/Este total não significa dinheiro livre/);});

test('Home não transforma planejamento futuro normal em alerta de atenção',()=>{
  assert.match(projectionReview,/actionableItems=items\.filter\(item=>item\.urgency_score>=55&&!excluded\.has\(item\.entity_id\)\)/);
  assert.match(projectionReview,/Conferir próximos valores/);
  assert.match(projectionReview,/Planejamentos futuros normais continuam na projeção sem virar alerta/);
  assert.doesNotMatch(projectionReview,/Atualizar previsões/);
});

test('member position is informational on Home and no longer exposes a generic settle button',()=>{
  assert.match(settlements,/Valores com pessoas/);
  assert.match(settlements,/current\?currentText:'Tudo equilibrado hoje'/);
  assert.doesNotMatch(settlements,/Acertar agora/);
  assert.match(settlements,/Ver tendência/);
  assert.match(settlements,/Ver histórico e compromissos/);
});

test('Home mantém histórico entre membros dentro do detalhe da relação',()=>{
  assert.match(settlements,/Ver histórico e compromissos/);
  assert.match(settlements,/pairEvents/);
  assert.match(settlements,/Transferência entre vocês/);
  assert.match(settlements,/text-cyan-200/);
});

test('Olhando pra frente separa realizado comprometido e planejado sem inflar riqueza futura',()=>{
  for(const value of ['Realizado','Comprometido','Planejado','já aconteceu','já existe para pagar','ainda pode mudar']) assert.match(home,new RegExp(value,'i'));
  assert.match(home,/mês de referência/i);
  assert.match(home,/remaining_commitments_in_month/);
  assert.match(home,/prior_pending_outflow/);
  assert.match(home,/projected_recurring_commitments/);
  assert.match(home,/expected_reliable_income_remaining/);
  assert.doesNotMatch(home,/não aumentam o saldo atual nem são somadas como riqueza futura acumulada/i);
});
