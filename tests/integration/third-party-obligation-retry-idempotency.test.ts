import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/finance/thirdPartyObligations.ts',import.meta.url),'utf8');
for(const operation of ['manual-third-party-obligation-create','manual-third-party-obligation-correct','manual-third-party-obligation-cancel','third-party-payable-forgive']){
 test(`${operation} keeps request key while outcome is uncertain`,()=>{
  assert.ok(source.includes(`getRetryStableRequestKey('${operation}'`));
  assert.ok(source.includes(`releaseRetryStableRequestKey('${operation}'`));
 });
}
test('keyed third-party commands no longer generate request key inline',()=>{assert.doesNotMatch(source,/p_request_key:\s*crypto\.randomUUID\(\)|const requestKey\s*=\s*crypto\.randomUUID\(\)/);});
test('write-off and settlement stay separate because their legacy RPCs do not yet accept request keys',()=>{assert.match(source,/write_off_receivable/);assert.match(source,/settle_financial_obligation/);});