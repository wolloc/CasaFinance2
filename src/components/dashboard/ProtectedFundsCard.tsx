import React from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  Building2,
  Plane,
  TrendingUp,
  Sparkles,
  ArrowRight,
  User,
  Calendar,
  Lock
} from 'lucide-react';
import type { ProtectedFund, ReserveDrainage } from '../../types/index.js';

interface ProtectedFundsCardProps {
  funds?: ProtectedFund[];
  drainages?: ReserveDrainage[];
  selectedMonth?: string;
}

export const ProtectedFundsCard: React.FC<ProtectedFundsCardProps> = ({
  funds = [],
  drainages = [],
  selectedMonth
}) => {
  const totalProtectedBalance = funds.reduce((sum, f) => sum + f.current_balance, 0);

  // Filter drainages for the selected month or show recent
  const relevantDrainages = drainages.filter((d) => {
    if (!selectedMonth) return true;
    return d.drainage_date.startsWith(selectedMonth);
  });

  const getFundIcon = (iconName?: string, name?: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('apartamento') || lower.includes('imóvel') || lower.includes('casa') || iconName === 'Building2') {
      return <Building2 className="w-4 h-4" />;
    }
    if (lower.includes('férias') || lower.includes('ferias') || lower.includes('viagem') || iconName === 'Plane') {
      return <Plane className="w-4 h-4" />;
    }
    return <TrendingUp className="w-4 h-4" />;
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div id="card-protected-funds" className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-5">
      {/* 1. Header do Módulo de Proteção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Blindagem de Patrimônio & Metas
              </span>
            </div>
            <h3 className="text-sm font-black text-white">
              Fundos Protegidos & Histórico de Drenagens
            </h3>
          </div>
        </div>

        <div className="text-left sm:text-right bg-slate-950/80 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-800/80">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Total Blindado</span>
          <span className="text-base sm:text-lg font-black text-amber-400">
            R$ {totalProtectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 2. Grid de Fundos Protegidos (Férias, PLR, Apartamento, Investimentos) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {funds.map((fund) => {
          const targetPercent = fund.target_amount && fund.target_amount > 0
            ? Math.min(100, Math.round((fund.current_balance / fund.target_amount) * 100))
            : null;

          return (
            <div
              key={fund.id}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2 hover:border-slate-700/80 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs shrink-0"
                    style={{ backgroundColor: fund.color || '#f59e0b' }}
                  >
                    {getFundIcon(fund.icon, fund.name)}
                  </div>
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">{fund.name}</span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Protegido</span>
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-sm sm:text-base font-black text-white block">
                  R$ {fund.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                {fund.target_amount ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Meta: R$ {fund.target_amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      <span className="font-bold text-amber-400">{targetPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${targetPercent}%`,
                          backgroundColor: fund.color || '#f59e0b'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 block truncate">
                    {fund.description || 'Fundo com blindagem ativa'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Linha do Tempo de Alertas de Resgates / Drenagens */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Linha do Tempo de Drenagens & Reclassificações
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {relevantDrainages.length} ocorrência(s)
          </span>
        </div>

        {relevantDrainages.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Nenhuma drenagem de capital registrada para este mês. Todos os fundos e reservas permanecem 100% blindados e excluídos do saldo livre.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {relevantDrainages.map((drainage) => (
              <div
                key={drainage.id}
                className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      ⚠️ R$ {drainage.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} retirados do {drainage.fund_name} para Saldo Livre
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                    em {formatDateBR(drainage.drainage_date)}
                  </span>
                </div>

                <div className="text-xs text-slate-300 pl-5 space-y-0.5">
                  <p className="leading-snug">
                    <span className="font-semibold text-slate-400">Motivo:</span> {drainage.reason}
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>Registrado por <strong className="text-slate-300">{drainage.user_name}</strong></span>
                    {drainage.destination_account_name && (
                      <span> • Destino: {drainage.destination_account_name}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
