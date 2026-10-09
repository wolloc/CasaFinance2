import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home = await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx', import.meta.url), 'utf8');
const statement = await readFile(new URL('../../src/components/app/MonthlyPositionStatement.tsx', import.meta.url), 'utf8');
const settlements = await readFile(new URL('../../src/components/app/SettlementHub.tsx', import.meta.url), 'utf8');
const projectionReview = await readFile(new URL('../../src/components/app/ProjectionReviewCenter.tsx', import.meta.url), 'utf8');
const financialMap = await readFile(new URL('../../src/components/app/HomeFinancialMap.tsx', import.meta.url), 'utf8');

test('Home traduz a posição financeira em leitura rápida',()=>{
  assert.match(home,/MonthlyPositionStatement/);
  assert.match(home,/Como estamos\?/);
  assert.match(home,/Olhando pra frente/);
  assert.match(home,/Entre vocês/);
  assert.doesNotMatch(home,/Alguns dados não atualizaram agora/);
  assert.match(home,/financial_household_opening_position_at_date/);
  assert.match(statement,/Estamos tranquilos neste mês/);
  assert.match(statement,/O mês fecha contando com o que ainda entra/);
});

test('Home mantém o resumo mensal fora de listas redundantes',()=>{
  assert.doesNotMatch(home,/title="Mês em resumo"/);
  assert.doesNotMatch(home,/Quanto das entradas consideradas já chegou/);
  assert.doesNotMatch(home,/Quanto dos compromissos considerados já aconteceu/);
});

test('posição entre moradores é informativa e abre histórico',()=>{
  assert.match(settlements,/Valores com pessoas/);
  assert.match(settlements,/Ver histórico e compromissos/);
  assert.doesNotMatch(settlements,/Acertar agora/);
});

test('Home mantém a análise por categorias em Gastos e Entradas',()=>{
  assert.doesNotMatch(home,/listEconomicMonthExpenses/);
  assert.doesNotMatch(home,/FinancialSectionHeading title="O que mais pesou"/);
});

test('Home não transforma planejamento futuro normal em alerta automaticamente',()=>{
  assert.match(projectionReview,/action_label/);
  assert.doesNotMatch(projectionReview,/Atualizar previsões/);
});


test('Mapa financeiro isola falhas entre blocos independentes',()=>{
  // Contrato de resiliência: uma falha local não deve derrubar os demais blocos.
  assert.match(financialMap,/HomeFinancialMapSectionBoundary label="Contas"/);
  assert.match(financialMap,/HomeFinancialMapSectionBoundary label="Cartões"/);
  assert.match(financialMap,/Valores com terceiros/);
  assert.match(financialMap,/Responsabilidades de terceiros/);
  assert.match(financialMap,/const safeResources=Array\.isArray\(resources\)\?resources:\[\]/);
  assert.match(financialMap,/const safeCards=Array\.isArray\(cards\)\?cards:\[\]/);
});
