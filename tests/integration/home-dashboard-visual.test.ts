import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home = await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');
const settlements = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');

test('Home traduz a posição financeira em leitura rápida para leigos',()=>{
  for(const value of ['Agora','Já tem destino','Livre depois deles','Deve sobrar no fim do mês','Temos <strong>','o mês tende a terminar em']) assert.match(home,new RegExp(value));
  assert.match(home,/healthText\[health\.health\]/);
  assert.match(home,/confidence&&confidence\.confidence_state!=='well_updated'/);
  assert.match(home,/confidence\.confidence_label/);
});

test('fluxo mensal separa realizado de previsto também visualmente',()=>{
  for(const value of ['já entrou','ainda esperado','já realizado\/pago','ainda pela frente','Quanto das entradas consideradas já chegou','Quanto dos compromissos considerados já aconteceu']) assert.match(home,new RegExp(value));
  assert.match(home,/ratio\(entered,incomeTotal\)/);
  assert.match(home,/ratio\(paid,commitmentTotal\)/);
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
  assert.match(home,/Todas as faturas/);
  assert.doesNotMatch(home,/Ver cartão e fatura/);
});
