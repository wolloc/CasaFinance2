import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component=await readFile(new URL('./ThirdPartyObligationManagement.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../finance/thirdPartyObligations.ts',import.meta.url),'utf8');

test('Novo acerto exposes manual obligation correction separately from settlement and economic events',()=>{
  assert.match(adjustment,/Corrigir valor com outra pessoa/);
  assert.match(adjustment,/selected==='third-party-manage'/);
  assert.match(adjustment,/ThirdPartyObligationManagement/);
  assert.match(component,/Corrigir valor com outra pessoa/);
  assert.match(component,/cadastro original estava errado/);
});

test('manual management delegates only to dedicated audited RPCs',()=>{
  assert.match(service,/rpc\('correct_manual_third_party_obligation'/);
  assert.match(service,/rpc\('cancel_manual_third_party_obligation'/);
  assert.match(service,/listEditableManualThirdPartyObligations/);
  assert.doesNotMatch(service,/correctManualThirdPartyObligation[\s\S]*from\('transactions'\).*insert/);
});

test('UI makes downstream financial effects a hard semantic boundary',()=>{
  assert.match(component,/Se já houve pagamento, recebimento, perda ou perdão, o Casa bloqueia esta rota/);
  assert.match(component,/“corrigir cadastro” é diferente de perda, perdão ou pagamento/);
  assert.match(component,/Nenhum caixa, renda, despesa ou funding foi criado/);
  assert.match(component,/Cadastro cancelado como erro administrativo/);
});

test('receivable versus payable direction is not editable in the correction form',()=>{
  assert.doesNotMatch(component,/setKind|name=["']kind["']/);
  assert.match(component,/Pessoa/);
  assert.match(component,/Valor/);
  assert.match(component,/Vencimento/);
});
