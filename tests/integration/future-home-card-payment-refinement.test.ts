import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cardSetup=await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx',import.meta.url),'utf8');
const invoice=await readFile(new URL('../../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('card identity edit exposes limit and cycle dates',()=>{
  assert.match(cardSetup,/Atualize identificação, limite e datas do cartão/);
  assert.match(cardSetup,/Limite do cartão/);
  assert.match(cardSetup,/Dia em que fecha/);
  assert.match(cardSetup,/Dia em que vence/);
  assert.match(cardSetup,/updateHouseholdCardIdentity/);
});

test('invoice payment follows the selected account owner when unambiguous',()=>{
  assert.match(invoice,/Saiu de qual conta\?/);
  assert.match(invoice,/Quem pagou\?/);
  assert.match(invoice,/account\.owner_member_ids/);
  assert.match(invoice,/owners\.length===1\)setFunderMemberId\(owners\[0\]\)/);
  assert.match(invoice,/Ao selecionar outra conta/);
});

test('future Casa view keeps the same operational blocks as the current Home',()=>{
  assert.match(home,/if\(referenceMonth&&currentReferenceMonth&&referenceMonth!==currentReferenceMonth\)/);
  assert.match(home,/title="Entre vocês"/);
  assert.match(home,/HomeFinancialMap resources=/);
  assert.match(home,/UpcomingFinancialEvents/);
  assert.match(home,/title="Olhando pra frente"/);
});
