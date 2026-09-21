import test from 'node:test';
import assert from 'node:assert/strict';
import { dateInTimeZone, monthStartInTimeZone } from './householdClock.js';

test('household financial date follows household timezone around UTC midnight',()=>{
  const instant=new Date('2026-09-21T00:30:00Z');
  assert.equal(dateInTimeZone('America/Sao_Paulo',instant),'2026-09-20');
  assert.equal(dateInTimeZone('UTC',instant),'2026-09-21');
  assert.equal(monthStartInTimeZone('America/Sao_Paulo',instant),'2026-09-01');
});
