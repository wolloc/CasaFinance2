import { expect, test, type Page } from '@playwright/test';

const apiBase = 'https://e2e.supabase.co';
const userId = '11111111-1111-4111-8111-111111111111';
const householdId = '22222222-2222-4222-8222-222222222222';
const now = new Date().toISOString();
const expiresAt = 4102444800;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: userId, aud: 'authenticated', role: 'authenticated', email: 'wallace@example.com', iat: 1700000000, exp: expiresAt })}.e2e`;

function user() {
  return {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'wallace@example.com',
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

async function installSupabaseMock(page: Page, options: { failMemberList?: boolean } = {}) {
  const rpcCalls: string[] = [];
  await page.route(`${apiBase}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
    };
    const fulfill = (body: unknown, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });
    console.log('[E2E Supabase]', request.method(), url.pathname, url.searchParams.get('select') ?? '');

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/auth/v1/token') {
      return fulfill({ access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: 'e2e-refresh', user: user() });
    }
    if (url.pathname === '/auth/v1/user') return fulfill(user());

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = url.pathname.split('/').pop() ?? '';
      rpcCalls.push(rpc);
      if (rpc === 'financial_household_health_position') return fulfill([{ household_id: householdId, reference_month: '2026-09-01', current_cash: 3000, expected_reliable_income_remaining: 2000, remaining_commitments: 5500, prior_pending_outflow: 0, projected_ending_cash: -500, projected_margin_ratio: -0.1, overdraft_used: 0, overdue_commitment_amount: 0, health: 'yellow', health_reason: 'projected_gap' }]);
      if (rpc === 'financial_priority_attention_items') return fulfill([]);
      if (rpc === 'financial_monthly_projection') return fulfill([{ financial_month: '2026-09-01', month_index: 0, opening_cash: 3000, realized_true_income_in_month: 0, expected_reliable_income_remaining: 2000, realized_commitments_in_month: 1500, remaining_commitments_in_month: 3000, projected_recurring_commitments: 1000, prior_pending_outflow: 0, projected_ending_cash: -500 }]);
      if (rpc === 'financial_liquidity_guidance') return fulfill([{ household_id: householdId, current_cash: 3000, committed_before_new_income: 5500, free_cash_after_commitments: -2500, reliable_income_remaining: 2000, projected_ending_cash: -500, coverage_gap: 500, reserve_balance: 1200, investment_balance: 0, overdraft_used: 0, guidance_state: 'needs_resource_reallocation', guidance_title: 'Falta dinheiro para cobrir o mês' }]);
      return fulfill([]);
    }

    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.replace('/rest/v1/', '');
      const select = decodeURIComponent(url.searchParams.get('select') ?? '').replace(/\s+/g, '');
      const wantsObject = (request.headers()['accept'] ?? '').includes('application/vnd.pgrst.object');
      if (table === 'household_members') {
        if (select.includes('household_id,profile_id') && !select.includes('id,household_id')) return fulfill({ household_id: householdId, profile_id: userId });
        if (select.includes('id,household_id,profile_id,role,status')) return fulfill({ id: 'm1', household_id: householdId, profile_id: userId, role: 'owner', status: 'active', profiles: { display_name: 'Wallace' } });
        if (options.failMemberList && select.includes('profiles(display_name)')) return fulfill({ code: 'E2E001', message: 'forced member list failure', details: null, hint: null }, 500);
        return fulfill([
          { id: 'm1', profile_id: userId, role: 'owner', profiles: { display_name: 'Wallace' } },
          { id: 'm2', profile_id: '33333333-3333-4333-8333-333333333333', role: 'member', profiles: { display_name: 'Guilherme' } },
        ]);
      }
      if (table === 'households') return fulfill({ id: householdId, name: 'Casa Teste' });
      if (table === 'financial_household_position') return fulfill({ household_id: householdId, available_money: 3000, restricted_resources: 0, reserves: 1200, investments: 0, receivables: 0, payables: 0, open_invoices: 0, committed_balance: 5500, projected_balance: -500 });
      if (table === 'financial_projection_confidence_positions') return fulfill({ confidence_state: 'well_updated', confidence_label: 'Projeção atualizada' });
      if (table === 'financial_account_balances') return fulfill([{ type: 'checking', resource_restriction: null, current_balance: 3000, is_restricted: false, is_investment: false }, { type: 'checking', resource_restriction: 'reserve', current_balance: 1200, is_restricted: true, is_investment: false }]);
      if (table === 'financial_card_health_positions') return fulfill([{ card_id: 'card-1', card_name: 'Porto', credit_limit: 5000, current_invoice_remaining: 800, future_known_commitments: 300, available_limit: 3900, utilization_ratio: 0.22, over_limit_amount: 0, next_due_date: '2026-09-15', card_health: 'green' }]);
      if (table === 'financial_member_positions' || table === 'financial_member_settlement_positions') return fulfill([]);
      return fulfill(wantsObject ? {} : []);
    }

    return fulfill({});
  });
  return rpcCalls;
}

async function submitLogin(page: Page) {
  await page.goto('/');
  await page.getByLabel('E-mail').fill('wallace@example.com');
  await page.getByLabel('Senha').fill('senha123');
  await page.getByRole('button', { name: 'Entrar com segurança' }).click();
  await page.waitForTimeout(750);
  console.log('[E2E screen after login]', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 800));
}

async function login(page: Page) {
  await submitLogin(page);
  await expect(page.getByText('Casa Teste')).toBeVisible();
}

test('login real do frontend entra na Casa e navega pelas áreas principais', async ({ page }) => {
  await installSupabaseMock(page);
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('button', { name: 'Gastos' }).click();
  await expect(page.getByText('Precisa fazer algo diferente?')).toBeVisible();
  await page.getByText('Precisa fazer algo diferente?').click();
  for (const label of ['Formas especiais de pagar', 'Recebeu dinheiro de volta?', 'Corrigir quem participou do gasto', 'Gastos que se repetem']) await expect(page.getByText(label)).toBeVisible();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  for (const label of ['Casa e membros', 'Contas, cartões e posição inicial', 'Categorias', 'Recorrências', 'Minha conta']) await expect(page.getByText(label)).toBeVisible();
});

test('falha ao reler membros bloqueia o produto financeiro e oferece retry', async ({ page }) => {
  await installSupabaseMock(page, { failMemberList: true });
  await submitLogin(page);
  await expect(page.getByText('Não foi possível conferir as pessoas da Casa')).toBeVisible();
  await expect(page.getByText(/não libera registros financeiros/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
});

test('cobertura abre apenas a próxima etapa e não executa RPC financeira de escrita', async ({ page }) => {
  const rpcCalls = await installSupabaseMock(page);
  await login(page);
  const before = [...rpcCalls];
  await page.getByRole('button', { name: 'Mover dinheiro de outra conta da Casa' }).click();
  await expect(page.getByRole('heading', { name: 'Cobrir falta projetada' })).toBeVisible();
  await expect(page.getByText(/É apenas uma referência/)).toBeVisible();
  const after = rpcCalls.slice(before.length);
  expect(after.some((name) => /(create|settle|pay|transfer|refund|forgive|write_off|record)/i.test(name))).toBe(false);
});
