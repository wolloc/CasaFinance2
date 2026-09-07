import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const settings = await readFile(new URL('../../src/components/app/SettingsScreen.tsx', import.meta.url), 'utf8');
const invite = await readFile(new URL('../../src/components/app/HouseholdInvitationSettings.tsx', import.meta.url), 'utf8');

test('Ajustes expõe convite dentro de Casa e membros',()=>{
  assert.match(settings,/HouseholdInvitationSettings/);
  assert.match(settings,/<HouseholdInvitationSettings\/>/);
  assert.match(invite,/Convidar a outra pessoa da Casa/);
});

test('somente owner com vaga pode gerar convite',()=>{
  assert.match(invite,/member\.profile_id===user\?\.id&&member\.role==='owner'/);
  assert.match(invite,/if\(!owner\)return null/);
  assert.match(invite,/householdMembers\.length>=2/);
  assert.match(invite,/createInvitation\(email\)/);
});

test('convite gera link compartilhável sem alterar regras do banco',()=>{
  assert.match(invite,/\?invitation=\$\{encodeURIComponent\(invitation\.token\)\}/);
  assert.match(invite,/navigator\.clipboard\.writeText/);
  assert.match(invite,/O Casa aceita no máximo duas pessoas ativas/);
});
