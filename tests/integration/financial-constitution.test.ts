import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const constitution = await readFile(new URL('../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');
const productSpec = await readFile(new URL('../../docs/product-spec-v2.md', import.meta.url), 'utf8');

test('financial constitution preserves the eleven product commandments', () => {
  for (let commandment = 1; commandment <= 11; commandment += 1) {
    assert.match(constitution, new RegExp(`^${commandment}\\. \\*\\*`, 'm'));
  }
  assert.match(constitution, /Comprador, titular do instrumento, responsável econômico e pagador\/funder são independentes/);
  assert.match(constitution, /Previsto não é realizado/);
  assert.match(constitution, /O passado financeiro não é apagado/);
  assert.match(constitution, /não deve fingir que consegue/);
});

test('financial constitution names the six financial engines', () => {
  for (const engine of ['Economia', 'Responsabilidade', 'Compromisso', 'Funding', 'Caixa', 'História']) {
    assert.ok(constitution.includes(`**${engine}**`), `missing financial engine: ${engine}`);
  }
});

test('constitution and product spec agree on the core UX and member semantics', () => {
  for (const principle of [
    'O usuário conta o que aconteceu; o Casa interpreta financeiramente o acontecimento.',
    'Wallace',
    'Guilherme',
  ]) {
    assert.ok(constitution.includes(principle));
    assert.ok(productSpec.includes(principle));
  }
  assert.match(constitution, /comprador ≠ titular ≠ responsável ≠ funder/);
  assert.match(productSpec, /Titular, comprador e responsável são independentes/);
});

test('constitution protects neutral movements from becoming income or expense', () => {
  assert.match(constitution, /Transferências patrimoniais não criam resultado econômico/);
  assert.match(constitution, /pagamento de fatura.*não cria novamente a despesa/s);
  assert.match(constitution, /recebimento de recebível, acerto entre membros, refund e resgate de principal/);
});
