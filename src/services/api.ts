import type {
  User,
  Household,
  HouseholdMember,
  Account,
  Card,
  Category,
  AuditLog,
  Transaction,
  PaymentMethod,
  SettlementBalance,
  Settlement,
  CoupleSettlementSummary,
  DashboardPerspective,
  DashboardFullResponse,
  MonthlyCommitmentProjection,
  ProtectedFund,
  ReserveDrainage
} from '../types';

export interface LoginResponse {
  user: User;
  households: Array<Household & { role: string }>;
  active_household: Household & { role: string };
}

export interface SecuritySuiteResult {
  all_passed: boolean;
  total_tests: number;
  passed_count: number;
  results: Array<{
    test_id: string;
    category?: string;
    description: string;
    passed: boolean;
    details: string;
  }>;
}

export class ApiService {
  private static getHeaders(userId?: string, householdId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (userId) headers['x-user-id'] = userId;
    if (householdId) headers['x-household-id'] = householdId;
    return headers;
  }

  private static async safeFetchJson<T>(
    url: string,
    options: RequestInit = {},
    fallbackData?: T
  ): Promise<T> {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        const text = await res.text();
        console.warn(`[ApiService] Resposta não-JSON recebida de ${url} (status ${res.status}):`, text.slice(0, 150));
        if (fallbackData !== undefined) return fallbackData;
        throw new Error(`Resposta do servidor inválida (${res.status}). Esperado JSON.`);
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || `Erro ${res.status} ao processar requisição`);
      }
      return json as T;
    } catch (err: any) {
      console.error(`[ApiService Error] ${url}:`, err);
      if (fallbackData !== undefined) {
        return fallbackData;
      }
      throw err;
    }
  }

  public static async getUsers(): Promise<{ users: User[] }> {
    return this.safeFetchJson('/api/auth/users', {}, { users: [] });
  }

  public static async login(userId: string): Promise<LoginResponse> {
    return this.safeFetchJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
  }

  public static async getHousehold(
    householdId: string,
    userId: string
  ): Promise<{ household: Household; members: HouseholdMember[] }> {
    return this.safeFetchJson(`/api/households/${householdId}`, {
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async getAccounts(householdId: string, userId: string): Promise<{ accounts: Account[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/accounts`,
      { headers: this.getHeaders(userId, householdId) },
      { accounts: [] }
    );
  }

  public static async createAccount(
    householdId: string,
    userId: string,
    data: Partial<Account>
  ): Promise<{ account: Account }> {
    return this.safeFetchJson(`/api/households/${householdId}/accounts`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async updateAccount(
    householdId: string,
    userId: string,
    accountId: string,
    data: Partial<Account>
  ): Promise<{ account: Account }> {
    return this.safeFetchJson(`/api/households/${householdId}/accounts/${accountId}`, {
      method: 'PUT',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async deleteAccount(
    householdId: string,
    userId: string,
    accountId: string
  ): Promise<{ success: boolean }> {
    return this.safeFetchJson(`/api/households/${householdId}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async getCards(householdId: string, userId: string): Promise<{ cards: Card[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/cards`,
      { headers: this.getHeaders(userId, householdId) },
      { cards: [] }
    );
  }

  public static async createCard(
    householdId: string,
    userId: string,
    data: Partial<Card>
  ): Promise<{ card: Card }> {
    return this.safeFetchJson(`/api/households/${householdId}/cards`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async updateCard(
    householdId: string,
    userId: string,
    cardId: string,
    data: Partial<Card>
  ): Promise<{ card: Card }> {
    return this.safeFetchJson(`/api/households/${householdId}/cards/${cardId}`, {
      method: 'PUT',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async deleteCard(
    householdId: string,
    userId: string,
    cardId: string
  ): Promise<{ success: boolean }> {
    return this.safeFetchJson(`/api/households/${householdId}/cards/${cardId}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async getCategories(householdId: string, userId: string): Promise<{ categories: Category[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/categories`,
      { headers: this.getHeaders(userId, householdId) },
      { categories: [] }
    );
  }

  public static async createCategory(
    householdId: string,
    userId: string,
    data: Partial<Category>
  ): Promise<{ category: Category }> {
    return this.safeFetchJson(`/api/households/${householdId}/categories`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async updateCategory(
    householdId: string,
    userId: string,
    categoryId: string,
    data: Partial<Category>
  ): Promise<{ category: Category }> {
    return this.safeFetchJson(`/api/households/${householdId}/categories/${categoryId}`, {
      method: 'PUT',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async inviteHouseholdMember(
    householdId: string,
    userId: string,
    data: { name: string; email: string; role?: 'owner' | 'member' }
  ): Promise<{ member: HouseholdMember }> {
    return this.safeFetchJson(`/api/households/${householdId}/members`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async getTransactions(
    householdId: string,
    userId: string
  ): Promise<{ transactions: Transaction[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/transactions`,
      { headers: this.getHeaders(userId, householdId) },
      { transactions: [] }
    );
  }

  public static async createTransaction(
    householdId: string,
    userId: string,
    data: any
  ): Promise<{ transaction: Transaction }> {
    return this.safeFetchJson(`/api/households/${householdId}/transactions`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async updateTransaction(
    householdId: string,
    userId: string,
    transactionId: string,
    data: any
  ): Promise<{ transaction: Transaction }> {
    return this.safeFetchJson(`/api/households/${householdId}/transactions/${transactionId}`, {
      method: 'PUT',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async refundTransaction(
    householdId: string,
    userId: string,
    transactionId: string,
    reason?: string
  ): Promise<{ transaction: Transaction; message: string }> {
    return this.safeFetchJson(`/api/households/${householdId}/transactions/${transactionId}/refund`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify({ reason })
    });
  }

  public static async calculateCardDates(
    householdId: string,
    userId: string,
    cardId: string,
    purchaseDate: string
  ): Promise<{ invoiceMonth: string; closingDate: string; dueDate: string; isAfterClosing: boolean }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/cards/${cardId}/calculate-dates?purchase_date=${purchaseDate}`,
      { headers: this.getHeaders(userId, householdId) }
    );
  }

  public static async deleteTransaction(
    householdId: string,
    userId: string,
    transactionId: string
  ): Promise<{ success: boolean }> {
    return this.safeFetchJson(`/api/households/${householdId}/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async getPaymentMethods(): Promise<{ payment_methods: PaymentMethod[] }> {
    return this.safeFetchJson('/api/payment-methods', {}, { payment_methods: [] });
  }

  public static async getSettlement(householdId: string, userId: string): Promise<{ settlement: SettlementBalance[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/settlement`,
      { headers: this.getHeaders(userId, householdId) },
      { settlement: [] }
    );
  }

  // SPRINT 6: Recurring Bills & Projections API Client
  public static async getRecurringBills(householdId: string, userId: string): Promise<{ recurring_bills: any[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/recurring-bills`,
      { headers: this.getHeaders(userId, householdId) },
      { recurring_bills: [] }
    );
  }

  public static async createRecurringBill(
    householdId: string,
    userId: string,
    data: any
  ): Promise<{ recurring_bill: any }> {
    return this.safeFetchJson(`/api/households/${householdId}/recurring-bills`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async toggleRecurringBillActive(
    householdId: string,
    userId: string,
    billId: string
  ): Promise<{ recurring_bill: any }> {
    return this.safeFetchJson(`/api/households/${householdId}/recurring-bills/${billId}/toggle-active`, {
      method: 'PATCH',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async deleteRecurringBill(
    householdId: string,
    userId: string,
    billId: string
  ): Promise<{ success: boolean }> {
    return this.safeFetchJson(`/api/households/${householdId}/recurring-bills/${billId}`, {
      method: 'DELETE',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async getBillOccurrences(
    householdId: string,
    userId: string,
    month?: string
  ): Promise<{ occurrences: any[]; month: string }> {
    const url = month
      ? `/api/households/${householdId}/bill-occurrences?month=${month}`
      : `/api/households/${householdId}/bill-occurrences`;
    return this.safeFetchJson(
      url,
      { headers: this.getHeaders(userId, householdId) },
      { occurrences: [], month: month || '' }
    );
  }

  public static async payBillOccurrence(
    householdId: string,
    userId: string,
    occurrenceId: string
  ): Promise<{ occurrence: any; transaction: any }> {
    return this.safeFetchJson(`/api/households/${householdId}/bill-occurrences/${occurrenceId}/pay`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId)
    });
  }

  public static async updateBillOccurrence(
    householdId: string,
    userId: string,
    occurrenceId: string,
    data: any
  ): Promise<{ success: boolean; occurrence: any }> {
    return this.safeFetchJson(`/api/households/${householdId}/bill-occurrences/${occurrenceId}`, {
      method: 'PUT',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  public static async getCommitmentsProjection(
    householdId: string,
    userId: string,
    monthsAhead: number = 12
  ): Promise<{ projections: MonthlyCommitmentProjection[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/commitments-projection?months_ahead=${monthsAhead}`,
      { headers: this.getHeaders(userId, householdId) },
      { projections: [] }
    );
  }

  // SPRINT 7: Couple Settlement API Client
  public static async getDetailedCoupleSettlement(
    householdId: string,
    userId: string,
    month?: string
  ): Promise<{ summary: CoupleSettlementSummary }> {
    const defaultSummary: CoupleSettlementSummary = {
      household_id: householdId,
      competence_month: month || '2026-05',
      wallace: { user_id: 'usr-wallace-001', user_name: 'Wallace', total_paid: 0, total_responsibility: 0, net_balance: 0 },
      guilherme: { user_id: 'usr-guilherme-002', user_name: 'Guilherme', total_paid: 0, total_responsibility: 0, net_balance: 0 },
      compensation: {
        status: 'settled',
        amount_to_pay: 0,
        debtor_id: null,
        debtor_name: null,
        creditor_id: null,
        creditor_name: null,
        pix_key: null,
        summary_text: 'Sem dados para o período'
      },
      contributing_transactions: [],
      settlement_history: []
    };

    const url = month
      ? `/api/households/${householdId}/couple-settlement?month=${month}`
      : `/api/households/${householdId}/couple-settlement`;

    return this.safeFetchJson(
      url,
      { headers: this.getHeaders(userId, householdId) },
      { summary: defaultSummary }
    );
  }

  public static async recordCoupleSettlement(
    householdId: string,
    userId: string,
    data: {
      payer_user_id: string;
      receiver_user_id: string;
      settled_amount: number;
      notes?: string;
    }
  ): Promise<{ settlement: Settlement; summary: CoupleSettlementSummary }> {
    return this.safeFetchJson(`/api/households/${householdId}/couple-settlement/record`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }

  // SPRINT 5 & NEW DASHBOARD: Structured Dashboard Data Fetcher
  public static async getDashboardData(
    householdId: string,
    userId: string,
    perspective: DashboardPerspective = 'couple',
    month?: string
  ): Promise<DashboardFullResponse> {
    const defaultResponse: DashboardFullResponse = {
      summary: {
        valorDisponivelLivre: 0,
        entradasDoMes: 0,
        gastosDoMes: 0,
        gastosFixosRecorrentes: 0,
        faturasEParcelasProjetadas: 0,
        current_month_spent: 0,
        previous_month_spent: 0,
        percentage_change: 0,
        month_income: 0,
        household_net_balance: 0,
        perspective,
        month_label: 'Mês Atual',
        competence_month: month || '2026-05'
      },
      cards: [],
      accounts: [],
      upcoming_commitments: [],
      settlement: {
        status: 'settled',
        amount: 0,
        summary_text: 'Sem dados para o período',
        wallace_paid: 0,
        wallace_responsibility: 0,
        guilherme_paid: 0,
        guilherme_responsibility: 0
      },
      category_breakdown: [],
      gastosPorCategoria: [],
      comprometimentoMeiosPagamento: [],
      projecaoFutura: [],
      patrimonioAcumulado: {
        saldo_contas: 0,
        total_faturas_abertas: 0,
        saldo_liquido_patrimonio: 0
      }
    };

    const url = `/api/households/${householdId}/dashboard?perspective=${perspective}${month ? `&month=${month}` : ''}`;
    return this.safeFetchJson(url, { headers: this.getHeaders(userId, householdId) }, defaultResponse);
  }

  public static async getAuditLogs(householdId: string, userId: string): Promise<{ logs: AuditLog[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/audit-logs`,
      { headers: this.getHeaders(userId, householdId) },
      { logs: [] }
    );
  }

  public static async runSecuritySuite(): Promise<SecuritySuiteResult> {
    return this.safeFetchJson(
      '/api/tests/run-security-suite',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
      },
      { all_passed: false, total_tests: 0, passed_count: 0, results: [] }
    );
  }

  // SPRINT 8: Protected Funds & Reserves
  public static async getProtectedFunds(householdId: string, userId: string): Promise<{ success: boolean; funds: ProtectedFund[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/protected-funds`,
      { headers: this.getHeaders(userId, householdId) },
      { success: true, funds: [] }
    );
  }

  public static async getReserveDrainages(householdId: string, userId: string): Promise<{ success: boolean; drainages: ReserveDrainage[] }> {
    return this.safeFetchJson(
      `/api/households/${householdId}/reserve-drainages`,
      { headers: this.getHeaders(userId, householdId) },
      { success: true, drainages: [] }
    );
  }

  public static async drainProtectedFund(
    householdId: string,
    userId: string,
    data: {
      fund_id: string;
      amount: number;
      reason: string;
      responsible_type?: 'wallace' | 'guilherme' | 'both';
      destination_account_id?: string | null;
      drainage_date?: string;
    }
  ): Promise<{ success: boolean; drainage: ReserveDrainage; updatedFund: ProtectedFund }> {
    return this.safeFetchJson(`/api/households/${householdId}/protected-funds/drain`, {
      method: 'POST',
      headers: this.getHeaders(userId, householdId),
      body: JSON.stringify(data)
    });
  }
}
