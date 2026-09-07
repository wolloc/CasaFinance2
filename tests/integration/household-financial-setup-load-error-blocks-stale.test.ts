import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx',import.meta.url),'utf8');
test('failed setup reread clears stale accounts cards and form',()=>{for(const snippet of ['setAccounts([]);','setCards([]);','setForm(null);'])assert.ok(source.includes(snippet));});
test('LIS contextual conclusion requires a successful reread',()=>{assert.match(source,/!loading&&!loadError&&initialAccountId/);assert.match(source,/limite do LIS continua sendo crédito\/dívida, não dinheiro disponível/);});
test('new financial registrations are blocked until reread succeeds',()=>{const guard=source.indexOf('if (loadError || loading)');const accountMutation=source.indexOf('await createHouseholdAccount');const cardMutation=source.indexOf('await createHouseholdCard');assert.ok(guard>=0&&accountMutation>guard&&cardMutation>guard);});
test('setup error never renders stale lists as real empty states',()=>{assert.match(source,/loadError \? <p className="text-sm text-slate-500">Recarregue os cadastros para visualizar ou adicionar contas/);assert.match(source,/loadError \? <p className="text-sm text-slate-500">Recarregue os cadastros para visualizar ou adicionar cartões/);});
test('card ownership still does not define buyer responsibility or payer',()=>{assert.match(source,/Ele não define comprador, responsável econômico ou pagador de futuras transações/);});
