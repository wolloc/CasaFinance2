import React, { useState, useEffect } from 'react';
import type { User, Account, Card, Category, PaymentMethod } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  Clock,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  Building,
  Tag,
  Users,
  Repeat,
  FileUp,
  FileText,
  UploadCloud,
  FileSearch,
  ScanLine,
  Image as ImageIcon
} from 'lucide-react';

interface Props {
  householdId: string;
  currentUser: User;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
}

export const PlanningAndOcrManager: React.FC<Props> = ({
  householdId,
  currentUser,
  accounts,
  cards,
  categories,
  paymentMethods
}) => {
  const [mainTab, setMainTab] = useState<'recurring' | 'ocr'>('recurring');
  const [subTab, setSubTab] = useState<'projection' | 'occurrences' | 'bills'>('projection');
  const [projectionRange, setProjectionRange] = useState<number>(6); // +1m, +3m, +6m, +12m
  const [projections, setProjections] = useState<any[]>([]);
  const [selectedMonthProjection, setSelectedMonthProjection] = useState<any | null>(null);

  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [recurringBills, setRecurringBills] = useState<any[]>([]);

  // OCR state
  const [ocrType, setOcrType] = useState<'receipt' | 'invoice'>('receipt');
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrResult, setOcrResult] = useState<any | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedCardForOcr, setSelectedCardForOcr] = useState<string>(cards[0]?.id || '');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Modal / Form state for new recurring bill
  const [isNewBillOpen, setIsNewBillOpen] = useState<boolean>(false);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formMerchant, setFormMerchant] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDueDay, setFormDueDay] = useState<number>(10);
  const [formCategory, setFormCategory] = useState<string>(categories[0]?.id || '');
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('pm-credit');
  const [formCard, setFormCard] = useState<string>(cards[0]?.id || '');
  const [formAccount, setFormAccount] = useState<string>(accounts[0]?.id || '');
  const [formBeneficiary, setFormBeneficiary] = useState<'both' | 'wallace' | 'guilherme'>('both');
  const [formBuyer, setFormBuyer] = useState<string>(currentUser.id);
  const [formPayer, setFormPayer] = useState<string>(currentUser.id);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [projRes, occRes, billsRes] = await Promise.all([
        ApiService.getCommitmentsProjection(householdId, currentUser.id, projectionRange),
        ApiService.getBillOccurrences(householdId, currentUser.id, currentMonth),
        ApiService.getRecurringBills(householdId, currentUser.id)
      ]);

      setProjections(projRes.projections || []);
      setOccurrences(occRes.occurrences || []);
      setRecurringBills(billsRes.recurring_bills || []);
      if (projRes.projections && projRes.projections.length > 0) {
        setSelectedMonthProjection(projRes.projections[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de planejamento');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [householdId, currentUser.id, currentMonth, projectionRange]);

  const handlePayOccurrence = async (occurrenceId: string) => {
    try {
      setIsActionLoading(true);
      await ApiService.payBillOccurrence(householdId, currentUser.id, occurrenceId);
      setSuccessMessage('Conta marcada como paga e debitada do livro razão com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao pagar conta');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleBillActive = async (billId: string) => {
    try {
      setIsActionLoading(true);
      await ApiService.toggleRecurringBillActive(householdId, currentUser.id, billId);
      setSuccessMessage('Status da conta fixa atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!confirm('Deseja realmente excluir este modelo de conta fixa?')) return;
    try {
      setIsActionLoading(true);
      await ApiService.deleteRecurringBill(householdId, currentUser.id, billId);
      setSuccessMessage('Conta fixa removida com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir conta fixa');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateNewBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formAmount);
    if (!formDescription || isNaN(amountVal) || amountVal <= 0) {
      setError('Preencha a descrição e um valor válido');
      return;
    }

    try {
      setIsActionLoading(true);
      await ApiService.createRecurringBill(householdId, currentUser.id, {
        description: formDescription,
        merchant: formMerchant || formDescription,
        expected_amount: amountVal,
        due_day: formDueDay,
        frequency: 'monthly',
        category_id: formCategory || undefined,
        payment_method_id: formPaymentMethod,
        account_id: formPaymentMethod === 'pm-credit' ? undefined : formAccount,
        card_id: formPaymentMethod === 'pm-credit' ? formCard : undefined,
        beneficiary_type: formBeneficiary,
        buyer_user_id: formBuyer,
        payer_user_id: formPayer,
        auto_generate: true
      });

      setIsNewBillOpen(false);
      setFormDescription('');
      setFormMerchant('');
      setFormAmount('');
      setSuccessMessage('Nova conta recorrente cadastrada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar conta fixa');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Month navigation helper
  const changeMonth = (offset: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonthStr);
  };

  // OCR Upload handler
  const handleFileUpload = async (file: File) => {
    setSelectedFileName(file.name);
    setOcrLoading(true);
    setOcrError(null);
    setOcrResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          if (ocrType === 'receipt') {
            const res = await fetch(`/api/households/${householdId}/ocr/receipt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id
              },
              body: JSON.stringify({
                base64_image: base64Data,
                mime_type: file.type || 'image/jpeg',
                file_name: file.name
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Falha ao processar recibo');
            setOcrResult(data.data);
            setSuccessMessage('Comprovante lido com sucesso pela Gemini AI!');
          } else {
            const res = await fetch(`/api/households/${householdId}/ocr/invoice-pdf`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': currentUser.id
              },
              body: JSON.stringify({
                base64_pdf: base64Data,
                card_id: selectedCardForOcr || undefined,
                file_name: file.name
              })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Falha ao processar fatura');
            setOcrResult(data.data);
            setSuccessMessage('Fatura PDF processada com sucesso pela Gemini AI!');
          }
        } catch (err: any) {
          setOcrError(err.message || 'Erro durante a extração inteligente via OCR');
        } finally {
          setOcrLoading(false);
        }
      };
    } catch (err: any) {
      setOcrError(err.message || 'Erro ao ler arquivo local');
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Navigation Switcher */}
      <div className="p-4 rounded-3xl bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                Planejamento & Automação
              </span>
              <h2 className="text-base font-black text-white">Contas Fixas & Leitura OCR</h2>
            </div>
          </div>
          {mainTab === 'recurring' && (
            <button
              onClick={() => setIsNewBillOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Conta
            </button>
          )}
        </div>

        {/* Main Segment Switcher */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setMainTab('recurring')}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mainTab === 'recurring'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>Contas Fixas & Projeção</span>
          </button>
          <button
            onClick={() => setMainTab('ocr')}
            className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mainTab === 'ocr'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            <span>Digitalização OCR (IA)</span>
          </button>
        </div>

        {/* Sub-tabs for Recurring Bills */}
        {mainTab === 'recurring' && (
          <div className="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setSubTab('projection')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                subTab === 'projection'
                  ? 'bg-slate-800 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" /> Projeção
            </button>
            <button
              onClick={() => setSubTab('occurrences')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                subTab === 'occurrences'
                  ? 'bg-slate-800 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Ocorrências Mês
            </button>
            <button
              onClick={() => setSubTab('bills')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                subTab === 'bills'
                  ? 'bg-slate-800 text-indigo-300 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Fixas ({recurringBills.length})
            </button>
          </div>
        )}
      </div>

      {/* Feedback Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-rose-400" />
          </button>
        </div>
      )}

      {/* =========================================
          TAB 1: RECURRING BILLS & PROJECTION
         ========================================= */}
      {mainTab === 'recurring' && (
        <>
          {/* SubTab: Projeção Futura */}
          {subTab === 'projection' && (
            <div className="space-y-4">
              {/* Range Selector */}
              <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <span className="text-xs font-bold text-slate-300">Horizonte de Projeção</span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setProjectionRange(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                        projectionRange === m
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly Cards List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {projections.map((p) => {
                  const isSelected = selectedMonthProjection?.month === p.month;
                  return (
                    <button
                      key={p.month}
                      onClick={() => setSelectedMonthProjection(p)}
                      className={`p-3 rounded-2xl text-left border transition-all ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase text-indigo-400 block">
                        {p.month_label}
                      </span>
                      <span className="text-sm font-black text-white block mt-1">
                        R$ {p.total_expected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                        <span>W: R$ {p.wallace_expected.toFixed(0)}</span>
                        <span>G: R$ {p.guilherme_expected.toFixed(0)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail of selected projection */}
              {selectedMonthProjection && (
                <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Detalhamento de {selectedMonthProjection.month_label}
                    </h3>
                    <span className="text-xs font-extrabold text-indigo-400">
                      Total: R$ {selectedMonthProjection.total_expected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedMonthProjection.items?.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-bold text-white block">{item.description}</span>
                          <span className="text-[10px] text-slate-400">
                            Vence dia {item.due_day} • {item.category_name}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-indigo-300">
                          R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SubTab: Ocorrências do Mês */}
          {subTab === 'occurrences' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-white uppercase">{currentMonth}</span>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {occurrences.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-900 rounded-2xl border border-slate-800">
                    Nenhuma ocorrência gerada para este mês.
                  </div>
                ) : (
                  occurrences.map((occ) => (
                    <div
                      key={occ.id}
                      className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{occ.description}</span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              occ.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {occ.status === 'paid' ? 'Pago' : 'Pendente'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Vencimento: {occ.due_date}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-white">
                          R$ {occ.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        {occ.status === 'pending' && (
                          <button
                            onClick={() => handlePayOccurrence(occ.id)}
                            disabled={isActionLoading}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold active:scale-95 transition-all"
                          >
                            Dar Baixa
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SubTab: Cadastro de Contas Fixas */}
          {subTab === 'bills' && (
            <div className="space-y-3">
              {recurringBills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{bill.description}</span>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          bill.is_active
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {bill.is_active ? 'Ativa' : 'Pausada'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Vence todo dia {bill.due_day} • {bill.category_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">
                      R$ {bill.expected_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => handleToggleBillActive(bill.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Pausar / Reativar"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteBill(bill.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-400"
                      title="Excluir"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =========================================
          TAB 2: OCR & IMPORTAÇÃO INTELIGENTE (IA)
         ========================================= */}
      {mainTab === 'ocr' && (
        <div className="space-y-4">
          {/* OCR Document Type Selector */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase">Gemini 2.5 Flash</span>
                <h3 className="text-sm font-bold text-white">Digitalização Automática de Gastos</h3>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOcrType('receipt')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  ocrType === 'receipt'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-indigo-400 mb-1" />
                <span className="text-xs font-bold block text-white">Foto de Comprovante</span>
                <span className="text-[10px] text-slate-400">Cupom fiscal, NFC-e ou recibo</span>
              </button>

              <button
                type="button"
                onClick={() => setOcrType('invoice')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  ocrType === 'invoice'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-400 mb-1" />
                <span className="text-xs font-bold block text-white">Fatura PDF de Cartão</span>
                <span className="text-[10px] text-slate-400">Extrato Nubank, Itaú ou Porto</span>
              </button>
            </div>

            {/* Target card for invoice */}
            {ocrType === 'invoice' && (
              <div className="pt-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Associar ao Cartão:
                </label>
                <select
                  value={selectedCardForOcr}
                  onChange={(e) => setSelectedCardForOcr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.brand})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Drag and Drop / File Input Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`p-8 rounded-3xl border-2 border-dashed text-center transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-950/40'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
            <span className="text-xs font-bold text-white block mb-1">
              {selectedFileName || 'Arraste ou selecione o arquivo aqui'}
            </span>
            <p className="text-[10px] text-slate-400 mb-4 max-w-xs mx-auto">
              {ocrType === 'receipt'
                ? 'Formatos aceitos: JPG, PNG, WEBP (fotos de comprovantes ou recibos Pix)'
                : 'Formatos aceitos: PDF (faturas consolidadas de cartões de crédito)'}
            </p>

            <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow-md active:scale-95 transition-all">
              <FileUp className="w-4 h-4" />
              <span>Escolher Arquivo</span>
              <input
                type="file"
                accept={ocrType === 'receipt' ? 'image/*' : 'application/pdf'}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          {/* OCR Processing State */}
          {ocrLoading && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 animate-pulse">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin mx-auto" />
              <span className="text-xs font-bold text-white block">
                Extraindo dados contábeis via Gemini AI...
              </span>
              <p className="text-[10px] text-slate-400">
                Identificando estabelecimento, valor, itens e categoria automática.
              </p>
            </div>
          )}

          {/* OCR Error Alert */}
          {ocrError && (
            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{ocrError}</span>
            </div>
          )}

          {/* OCR Success Result Card */}
          {ocrResult && (
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Dados Extraídos com Sucesso
                </span>
                <span className="text-[10px] text-slate-400">Confiança Alta</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Estabelecimento</span>
                  <span className="font-bold text-white">{ocrResult.merchant || ocrResult.title || 'N/D'}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Valor Total</span>
                  <span className="font-extrabold text-emerald-400">
                    R$ {(ocrResult.total_amount || ocrResult.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {ocrResult.suggested_category && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Categoria Sugerida:</span>
                  <span className="font-bold text-indigo-300">{ocrResult.suggested_category}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Conta Fixa */}
      {isNewBillOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-md text-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">Cadastrar Nova Conta Fixa</h3>
              <button onClick={() => setIsNewBillOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateNewBill} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel, Internet Fibra, Netflix"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Categoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Divisão de Responsabilidade
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('both')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      formBeneficiary === 'both'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    🤝 50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('wallace')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      formBeneficiary === 'wallace'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    👤 Wallace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('guilherme')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      formBeneficiary === 'guilherme'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    👤 Gui
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBillOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar Conta Fixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
