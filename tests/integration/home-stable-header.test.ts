import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('Casa keeps a stable page header regardless of perspective',()=>{
  assert.match(home,/<FinancialPageHeader title="Casa"\/>/);
  assert.doesNotMatch(home,/Perspectiva financeira<\/p><h1/);
  assert.doesNotMatch(home,/perspective==='household'\?household\?\.name:selectedMember/);
});

test('perspective remains a filter below the period instead of becoming the title',()=>{
  assert.match(home,/const selector=<FinancialPerspectiveSelector/);
  assert.match(home,/\{monthNavigator\}\s*\{selector\}/);
});
