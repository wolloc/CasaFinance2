import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvestmentReserveAdjustment.tsx',import.meta.url),'utf8');
test('failed investment reread clears stale resources history and selections',()=>{for(const snippet of ['setResources([]);','setHistory([]);',"setTransactionalAccountId('');","setInvestmentAccountId('');","setAmount('');"])assert.ok(source.includes(snippet));});
test('investment actions are hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<>/);});
test('stale context cannot move principal or record performance',()=>{const principalGuard=source.indexOf('if(loadError||loading)');const principalMutation=source.indexOf('await moveInvestmentReservePrincipal');const performanceGuard=source.indexOf("if(loadError||loading){setError('Confira novamente investimentos e reservas");const performanceMutation=source.indexOf('await recordInvestmentPerformance');assert.ok(principalGuard>=0&&principalMutation>principalGuard);assert.ok(performanceGuard>=0&&performanceMutation>performanceGuard);});
test('principal and performance semantics remain distinct',()=>{assert.match(source,/Aporte registrado\. O dinheiro apenas mudou de lugar e nenhuma despesa foi criada/);assert.match(source,/Rendimento registrado\. O investimento vale mais, mas esse valor continua aplicado até um resgate/);assert.match(source,/A perda reduz o valor do investimento\. Ela não é tratada como compra ou gasto de consumo/);});

test('falha do histórico não bloqueia aporte ou resgate',()=>{assert.match(source,/histórico de investimento indisponível; aporte e resgate continuam disponíveis/);assert.doesNotMatch(source,/Promise\.all\(\[listInvestmentReserveResources/);});
