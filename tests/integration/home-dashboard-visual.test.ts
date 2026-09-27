import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home = await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');
const settlements = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');
const projectionReview = await readFile(new URL('../../src/components/app/ProjectionReviewCenter.tsx', import.meta.url), 'utf8');

test('Home traduz a posição financeira em leitura rápida para leigos',()=>{
  for(const value of ['Agora','Já tem destino','Livre depois deles','Deve sobrar no fim do mês','Temos <strong>','o mês tende a terminar em']) assert.match(home,new RegExp(value));
  assert.match(home,/healthText\[health\.health\]/);
  assert.match(home,/confidence&&confidence\.confidence_state!=='well_updated'/);
  assert.match(home,/confidence\.confidence_label/);
});

test('resumo mensal separa o que aconteceu do que ainda vem sem duplicar as listas',()=>{
  for(const value of ['Mês em resumo','Entrou','Ainda entra','Já comprometido','Ainda compromete','Detalhes de entradas e gastos ficam nas áreas próprias']) assert.match(home,new RegExp(value));
  assert.match(home,/realized_true_income_in_month/);
  assert.match(home,/expected_reliable_income_remaining/);
  assert.match(home,/realized_commitments_in_month/);
  assert.match(home,/projected_recurring_commitments/);
  assert.doesNotMatch(home,/Quanto das entradas consideradas já chegou/);
  assert.doesNotMatch(home,/Quanto dos compromissos considerados já aconteceu/);
});

test('Home resume top categorias pelo gasto econômico realizado sem chamar de orçamento',()=>{
  assert.match(home,/listEconomicMonthExpenses/);
  assert.match(home,/O que mais pesou/);
  assert.match(home,/top 3 categorias/);
  assert.match(home,/Compra parcelada entra uma vez pelo valor da compra/);
  assert.match(home,/Isso não é uma meta de orçamento/);
});

test('acerto realizado usa frase direcional de recebimento',()=>{
  assert.match(settlements,/tem a receber de/);
});


test('projeção futura mostra tendência entre meses comparáveis',()=>{
  assert.match(home,/vs\. mês anterior/);
  assert.match(home,/previousEnding/);
  assert.match(home,/delta=previousEnding===null\?null:ending-previousEnding/);
});

test('Home torna recursos exploráveis e cartões navegáveis sem CTA duplicado dominante',()=>{
  for(const value of ['Contas e dinheiro','Benefícios','Reservas','Investimentos','Patrimônio financeiro acompanhado']) assert.match(home,new RegExp(value));
  assert.match(home,/role="button" tabIndex=\{0\} onClick=\{\(\)=>onOpenCard\?\.\(c\.card_id\)\}/);
  assert.doesNotMatch(home,/Todas as faturas/);
  assert.doesNotMatch(home,/Ver cartão e fatura/);
});

test('Home dá mais hierarquia a Contas e recursos sem chamar patrimônio de dinheiro livre',()=>{assert.match(home,/Contas e recursos/);assert.match(home,/Saldo de uso, benefícios, reservas e investimentos continuam separados/);assert.match(home,/Este total não significa dinheiro livre/);assert.match(home,/border-blue-950\/70/);assert.match(home,/Toque para agir sobre cada recurso/);});

test('Home não transforma planejamento futuro normal em alerta de atenção',()=>{
  assert.match(projectionReview,/actionableItems=items\.filter\(item=>item\.urgency_score>=55\)/);
  assert.match(projectionReview,/Conferir próximos valores/);
  assert.match(projectionReview,/Planejamentos futuros normais continuam na projeção sem virar alerta/);
  assert.doesNotMatch(projectionReview,/Atualizar previsões/);
});

test('member position is informational on Home and no longer exposes a generic settle button',()=>{
  assert.match(settlements,/Valores com pessoas/);
  assert.match(settlements,/posição de hoje/);
  assert.doesNotMatch(settlements,/Acertar agora/);
  assert.match(settlements,/pode ter a receber de/);
  assert.match(settlements,/Ainda não existe valor para acertar agora/);
});

test('Home mostra histórico entre membros como movimento neutro, não renda ou gasto',()=>{
  assert.match(settlements,/Histórico entre vocês/);
  assert.match(settlements,/Movimentos neutros que alteraram a posição entre vocês sem virar renda ou gasto/);
  assert.match(settlements,/Movimento entre vocês/);
  assert.match(settlements,/event\.kind==='explicit_settlement'/);
  assert.match(settlements,/event\.state==='realized'/);
  assert.match(settlements,/text-cyan-200/);
});

test('Olhando pra frente separa realizado comprometido e planejado sem inflar riqueza futura',()=>{
  for(const value of ['Realizado','Comprometido','Planejado','já aconteceu','já existe para pagar','ainda pode mudar']) assert.match(home,new RegExp(value,'i'));
  assert.match(home,/Mês de referência \+ próximos 3 meses/i);
  assert.match(home,/remaining_commitments_in_month/);
  assert.match(home,/prior_pending_outflow/);
  assert.match(home,/projected_recurring_commitments/);
  assert.match(home,/expected_reliable_income_remaining/);
  assert.match(home,/não aumentam o saldo atual nem são somadas como riqueza futura acumulada/i);
});
