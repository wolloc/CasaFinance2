import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ApiService } from '../../services/api.js';
import type { CoupleSettlementSummary } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from '../common/IOSBottomSheet.js';

interface CoupleSettlementManagerProps {
  householdId: string;
  userId: string;
  onRefreshParent?: () => void;
}

export const CoupleSettlementManager: React.FC<CoupleSettlementManagerProps> = ({
  householdId,
  userId,
  onRefreshParent
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CoupleSettlementSummary | null>(null);

  // Month filter (defaults to current month YYYY-MM)
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');

  // Interactive states
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [showPixSheet, setShowPixSheet] = useState<boolean>(false);
  const [settlementAmount, setSettlementAmount] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Collapsible detail sections
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
  const [showTransactions, setShowTransactions] = useState<boolean>(false);

  const loadSettlement = async () => {
    try {
      setLoading(true);
      setError(null);
      const monthParam = viewMode === 'month' ? selectedMonth : undefined;
      const res = await ApiService.getDetailedCoupleSettlement(householdId, userId, monthParam);
      setSummary(res.summary);
      if (res.summary.compensation.amount_to_pay > 0) {
        setSettlementAmount(res.summary.compensation.amount_to_pay.toFixed(2));
      } else {
        setSettlementAmount('');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao calcular acerto do casal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlement();
  }, [householdId, userId, selectedMonth, viewMode]);

  const handleCopyPix = (key: string) => {
    if (!key) return;
    triggerHaptic('success');
    navigator.clipboard.writeText(key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    triggerHaptic('selection');
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    const newMonthStr = newDate.toISOString().substring(0, 7);
    setSelectedMonth(newMonthStr);
  };

  const handleConfirmSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || !summary.compensation.debtor_id || !summary.compensation.creditor_id) return;
    const amountNum = parseFloat(settlementAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Informe um valor de liquidação válido.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await ApiService.recordCoupleSettlement(householdId, userId, {
        payer_user_id: summary.compensation.debtor_id,
        receiver_user_id: summary.compensation.creditor_id,
        settled_amount: amountNum,
        notes: settlementNotes || `Acerto via Pix efetuado em ${new Date().toLocaleDateString('pt-BR')}`
      });

      triggerHaptic('success');
      setFeedbackSuccess(`Acerto de R$ ${amountNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado!`);
      setSummary(res.summary);
      setShowPixSheet(false);
      setSettlementNotes('');
      if (onRefreshParent) onRefreshParent();
      setTimeout(() => setFeedbackSuccess(null), 5000);
    } catch (err: any) {
      triggerHaptic('error');
      alert(err.message || 'Erro ao registrar liquidação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatMonthTitle = (mStr: string) => {
    const [year, month] = mStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const isSettled = summary?.compensation.status === 'settled' || (summary?.compensation.amount_to_pay || 0) <= 0.01;

  return (
    <div id="couple-settlement-module" className="space-y-4">
      {/* 1. Header & Navigation */}
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/15 text-sky-400 flex items-center justify-center border border-sky-500/25">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">
                Compensação 50/50
              </span>
              <h2 className="text-base font-black text-white">Acerto do Casal</h2>
            </div>
          </div>

          <span className="text-[11px] bg-slate-800 text-slate-300 font-semibold px-2.5 py-1 rounded-full border border-slate-700 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Anti-Dupla Contagem
          </span>
        </div>

        {/* Month Picker / Period Selector */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setViewMode('month');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all min-h-touch ${
                viewMode === 'month' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => {
                triggerHaptic('selection');
                setViewMode('all');
              }}
              className={`px-3 py-1.5 rounded-xl transition-all min-h-touch ${
                viewMode === 'all' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Acumulado
            </button>
          </div>

          {viewMode === 'month' && (
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-2xl px-2 py-1">
              <button
                onClick={() => handleMonthChange('prev')}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition min-h-touch min-w-touch flex items-center justify-center"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 px-2 font-bold text-xs capitalize text-slate-200">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                {formatMonthTitle(selectedMonth)}
              </div>
              <button
                onClick={() => handleMonthChange('next')}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition min-h-touch min-w-touch flex items-center justify-center"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {feedbackSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3.5 rounded-2xl flex items-center justify-between text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{feedbackSuccess}</span>
          </div>
          <button
            onClick={() => setFeedbackSuccess(null)}
            className="text-emerald-400 font-bold px-2 py-1"
          >
            OK
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3.5 rounded-2xl flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-2">
          <div className="inline-block animate-spin rounded-full h-7 w-7 border-3 border-sky-500 border-t-transparent"></div>
          <p className="text-slate-400 text-xs font-semibold">Calculando balanço contábil neutro...</p>
        </div>
      ) : summary ? (
        <>
          {/* 2. CARD CENTRAL HERO (ZERO DÚVIDA) */}
          <div
            id="settlement-hero-card"
            className="p-5 sm:p-6 rounded-3xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-xl space-y-4 text-center"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-950 border border-slate-800">
              {isSettled ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Contas Equilibradas</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-amber-400">Compensação Pendente</span>
                </>
              )}
            </div>

            {/* Natural Language Highlight */}
            {isSettled ? (
              <div className="space-y-1 py-2">
                <h3 className="text-lg font-black text-white">
                  Contas do mês equilibradas
                </h3>
                <p className="text-xs text-slate-400">
                  Nenhuma transferência ou acerto pendente entre Wallace e Guilherme.
                </p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Balanço Contábil Final
                </span>
                <div className="text-xl sm:text-2xl font-black text-white tracking-tight flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-amber-400">{summary.compensation.debtor_name}</span>
                  <span>deve</span>
                  <span className="text-3xl font-black text-emerald-400">
                    {formatCurrency(summary.compensation.amount_to_pay)}
                  </span>
                  <span>para</span>
                  <span className="text-sky-400">{summary.compensation.creditor_name}</span>
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {summary.compensation.summary_text}
                </p>
              </div>
            )}

            {/* AÇÃO PRINCIPAL EM 1 TOQUE: BOTAO FAZER ACERTO PIX */}
            {!isSettled && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('impact-medium');
                  setShowPixSheet(true);
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white text-sm font-black shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Fazer Acerto Pix ({formatCurrency(summary.compensation.amount_to_pay)})</span>
              </button>
            )}
          </div>

          {/* 3. DETALHAMENTO EM SANFONA (OPCIONAL / DISCRETO) */}
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setShowBreakdown(!showBreakdown);
              }}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors min-h-touch cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-300">
                  Ver Detalhamento Pagos vs Devidos
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>{showBreakdown ? 'Ocultar' : 'Expandir'}</span>
                {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showBreakdown && (
              <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Wallace Box */}
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Wallace</span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatCurrency(summary.wallace.net_balance)}</span>
                  </div>
                  <div className="text-[11px] space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Pago:</span>
                      <strong className="text-emerald-400">{formatCurrency(summary.wallace.total_paid)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Responsabilidade:</span>
                      <strong className="text-slate-200">{formatCurrency(summary.wallace.total_responsibility)}</strong>
                    </div>
                  </div>
                </div>

                {/* Guilherme Box */}
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">Guilherme</span>
                    <span className="text-[10px] text-slate-400 font-mono">{formatCurrency(summary.guilherme.net_balance)}</span>
                  </div>
                  <div className="text-[11px] space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Pago:</span>
                      <strong className="text-emerald-400">{formatCurrency(summary.guilherme.total_paid)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Responsabilidade:</span>
                      <strong className="text-slate-200">{formatCurrency(summary.guilherme.total_responsibility)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. BOTTOM SHEET: FAZER ACERTO PIX */}
          <IOSBottomSheet
            isOpen={showPixSheet}
            onClose={() => setShowPixSheet(false)}
            title="Fazer Acerto Pix"
            subtitle={`Transferência de ${summary.compensation.debtor_name} para ${summary.compensation.creditor_name}`}
          >
            <form onSubmit={handleConfirmSettlement} className="space-y-4 text-xs">
              {/* Pre-filled amount hero */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Valor da Liquidação
                </span>
                <div className="text-3xl font-black text-emerald-400 tracking-tight">
                  {formatCurrency(parseFloat(settlementAmount) || summary.compensation.amount_to_pay)}
                </div>
                <p className="text-[11px] text-slate-400">
                  Favorecido: <strong className="text-white">{summary.compensation.creditor_name}</strong>
                </p>
              </div>

              {/* Chave Pix e botão copiar */}
              {summary.compensation.pix_key && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Chave Pix ({summary.compensation.creditor_name})
                  </span>
                  <div className="flex items-center justify-between gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-xs text-white">
                    <span className="truncate">{summary.compensation.pix_key}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPix(summary.compensation.pix_key!)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all min-h-touch cursor-pointer"
                    >
                      {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Valor customizável se desejar ajuste */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Valor a Liquidar (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:outline-none focus:border-emerald-500 min-h-touch"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Acerto mensal pago via Pix Nubank"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 min-h-touch"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Registrando...' : 'Confirmar e Liquidar Saldo'}</span>
              </button>
            </form>
          </IOSBottomSheet>
        </>
      ) : null}
    </div>
  );
};
