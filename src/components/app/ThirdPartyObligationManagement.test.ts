import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component=await readFile(new URL('./ThirdPartyObligationManagement.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../finance/thirdPartyObligations.ts',import.meta.url),'utf8');

test('Novo acerto exposes manual value correction separately from settlement and economic events',()=>{
  assert.match(adjustment,/Corrigir valor com outra pessoa/);
  assert.match(adjustment,/selected==='third-party-manage'/);
  assert.match(adjustment,/ThirdPartyObligationManagement/);
  assert.match(component,/Corrigir um valor cadastrado/);
  assert.match(component,/cadastro original estava errado/);
});

test('manual management delegates only to dedicated audited RPCs',()=>{
  assert.match(service,/rpc\('correct_manual_third_party_obligation'/);
  assert.match(service,/rpc\('cancel_manual_third_party_obligation'/);
  assert.match(service,/listEditableManualThirdPartyObligations/);
  assert.doesNotMatch(service,/correctManualThirdPartyObligation[\s\S]*from\('transactions'\).*insert/);
});

test('UI keeps downstream financial effects as a hard boundary',()=>{
  assert.match(component,/Se já houve pagamento, recebimento, perda ou perdão, o Casa bloqueia a correção/);
  assert.match(component,/corrigir um cadastro errado é diferente de registrar pagamento, perdão ou perda/);
  assert.match(component,/Nenhum dinheiro entrou ou saiu e nenhuma renda ou gasto novo foi criado/);
  assert.match(component,/Cadastro cancelado porque estava errado/);
});

test('receivable versus payable direction is not editable in the correction form',()=>{
  assert.doesNotMatch(component,/setKind|name=["']kind["']/);
  assert.match(component,/Com quem\?/);
  assert.match(component,/Quanto\?/);
  assert.match(component,/Quando deve ser pago\?/);
});
