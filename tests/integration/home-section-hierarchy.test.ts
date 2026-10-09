import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const upcoming=await readFile(new URL('../../src/components/app/UpcomingFinancialEvents.tsx',import.meta.url),'utf8');
const settlements=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
const heading=await readFile(new URL('../../src/components/app/FinancialSectionHeading.tsx',import.meta.url),'utf8');

test('Home usa uma única hierarquia para títulos de seção',()=>{
  for(const title of ['Como estamos?','Entre vocês','Olhando pra frente']){
    assert.match(home,new RegExp(`FinancialSectionHeading[^\\n]*title="${title.replace(/[?]/g,'\\\\?')}"`));
  }
  assert.match(home,/HomeFinancialMap/);
  assert.match(priority,/<summary[^\\n]*>/);
  assert.match(priority,/Precisa de atenção/);
  assert.match(priority,/\\{children\\}/);
  assert.match(upcoming,/embedded/);
  assert.match(upcoming,/Próximos 7 dias/);
  assert.match(settlements,/FinancialSectionHeading[^\\n]*title="Valores com pessoas"/);
});

test('escala de seção é definida em um único lugar',()=>{
  assert.match(heading,/text-base font-extrabold leading-snug text-slate-100 sm:text-lg/);
  assert.match(heading,/text-sm leading-5 text-slate-400/);
  assert.match(heading,/text-\\[11px\\] font-bold uppercase tracking-\\[0\\.12em\\]/);
});


test('centro de atenção usa datas e severidade em linguagem humana',()=>{
 assert.match(priority,/shortDate/);
 assert.match(priority,/Ação importante/);
 assert.match(priority,/Vale conferir/);
 assert.doesNotMatch(priority,/\\{item\\.due_date\\}<\\/span>/);
});
