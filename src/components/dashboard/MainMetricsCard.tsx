import React from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  Clock,
  CheckCircle2,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import type { DashboardSummaryData, DashboardCardItem, DashboardPatrimonio } from '../../types/index.js';

interface MainMetricsCardProps {
  summary: DashboardSummaryData;
  cards?: DashboardCardItem[];
  patrimonio?: DashboardPatrimonio;
}

export const MainMetricsCard: React.FC<MainMetricsCardProps> = ({
  summary,
  patrimonio
}) => {
  // 1. Entradas e Saídas do Período (Pagas / Realizadas)
  const income = summary.entradasDoMes ?? summary.month_income ?? 0;
  const spent = summary.gastosDoMes ?? summary.current_month_spent ?? 0;

  // 2. Balanço Real do Mês (Pago/Recebido)
  const monthlyBalance = summary.resultadoRealMes ?? Number((income - spent).toFixed(2));
  const isBalancePositive = monthlyBalance >= 0;

  // 3. Saldo Real Consolidado (Líquido em contas - Pago/Recebido)
  const saldoReal = summary.saldoRealConsolidado ?? patrimonio?.saldo_contas ?? summary.household_net_balance ?? 0;
  const isSaldoRealPositive = saldoReal >= 0;

  // 4. Fatura / Projeção do Mês (Comprometimento Total)
  const faturasMes = summary.faturasMes ?? summary.faturasEParcelasProjetadas ?? 0;
  const contasPrevistas = summary.contasPrevistasMes ?? summary.gastosFixosRecorrentes ?? 0;
  const comprometimentoTotal = summary.comprometimentoTotalMes ?? Number((faturasMes + contasPrevistas).toFixed(2));

  // 5. Saldo Projetado ao Fim do Mês (Saldo Real - Comprometimento)
  const saldoProjetado = summary.saldoProjetadoFimMes ?? Number((saldoReal - comprometimentoTotal).toFixed(2));
  const isProjetadoPositive = saldoProjetado >= 0;

  const perspectiveLabel =
    summary.perspective === 'couple' ? 'Casal' :
    summary.perspective === 'wallace' ? 'Wallace' : 'Guilherme';

  return (
    <div
      id="card-main-metrics-consolidated"
      className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-4 sm:p-6 space-y-4"
    >
      {/* Header Conciso: Perspectiva e Status Geral */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Painel Financeiro Estruturado • {perspectiveLabel}
          </h2>
        </div>

        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
            isProjetadoPositive
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          {isProjetadoPositive ? (
            <>
              <ShieldCheck className="w-3 h-3" />
              <span>Projeção Saudável</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              <span>Atenção: Comprometimento Elevado</span>
            </>
          )}
        </span>
      </div>

      {/* BLOCO CENTRAL: OS 2 INDICADORES CRUCIAIS (SALDO REAL VS. FATURA/PROJEÇÃO DO MÊS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* INDICADOR 1: SALDO REAL / CONSOLIDADO */}
        <div
          id="indicator-saldo-real"
          className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 border border-emerald-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  Saldo Real / Consolidado
                </span>
                <span className="text-[10px] text-slate-400">
                  Apenas receitas e despesas com status Pago/Recebido
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              Pago
            </span>
          </div>

          <div className="my-1">
            <span
              className={`text-2xl sm:text-3xl font-black tracking-tight block ${
                isSaldoRealPositive ? 'text-white' : 'text-rose-400'
              }`}
            >
              R$ {saldoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-400/90 font-medium block mt-0.5">
              Saldo disponível liquidado em contas e carteiras
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Entradas Pagas:</span>
              <span className="font-bold text-emerald-400">
                R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Saídas Pagas:</span>
              <span className="font-bold text-rose-400">
                R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* INDICADOR 2: FATURA / PROJEÇÃO DO MÊS */}
        <div
          id="indicator-fatura-projecao"
          className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 border border-amber-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-black text-white uppercase tracking-wider block">
                  Fatura / Projeção do Mês
                </span>
                <span className="text-[10px] text-slate-400">
                  Parcelas do mês atual e contas Previstas
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
              Comprometimento
            </span>
          </div>

          <div className="my-1">
            <span className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight block">
              R$ {comprometimentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
              <span className="text-slate-400">Saldo projetado ao fim do mês:</span>
              <span className={`font-black ${isProjetadoPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                R$ {saldoProjetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Faturas & Parcelas:</span>
              <span className="font-bold text-slate-200">
                R$ {faturasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Contas Previstas:</span>
              <span className="font-bold text-purple-300">
                R$ {contasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Consolidado dos 4 Pilares de Apoio (Saldo Atual, Entradas, Saídas, Balanço) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
        {/* 1. Saldo em Contas */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo em Contas</span>
            <Wallet className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <span
              className={`text-base sm:text-lg font-black tracking-tight block ${
                isSaldoRealPositive ? 'text-white' : 'text-rose-400'
              }`}
            >
              R$ {saldoReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Dinheiro em conta
            </span>
          </div>
        </div>

        {/* 2. Entradas Realizadas */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Entradas</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-emerald-400 tracking-tight block">
              R$ {income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Receitas liquidadas
            </span>
          </div>
        </div>

        {/* 3. Saídas Realizadas */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saídas</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black text-rose-400 tracking-tight block">
              R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Despesas liquidadas
            </span>
          </div>
        </div>

        {/* 4. Balanço do Período */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Balanço do Mês</span>
            <Scale className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div>
            <span
              className={`text-base sm:text-lg font-black tracking-tight block ${
                isBalancePositive ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {isBalancePositive ? '+ ' : ''}
              R$ {monthlyBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              Entradas - Saídas Pagas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
