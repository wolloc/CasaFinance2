import React from 'react';
import { CheckCircle2, Layers, Database, Shield, Server, Smartphone } from 'lucide-react';

export const SprintSummaryCard: React.FC = () => {
  const deliverables = [
    { title: 'Arquitetura de Dados Normalizada', desc: 'Entidades, Ledger, RLS, Chaves Estrangeiras e Constraints', icon: Database },
    { title: 'Isolamento Multi-Tenant & RLS', desc: 'Prevenção rígida contra vazamento de dados entre Households', icon: Shield },
    { title: 'Household Inicial do Casal', desc: 'Casa Wallace & Guilherme configurado com papéis de co-proprietários', icon: Layers },
    { title: 'Seed do Marco Zero', desc: '4 Cartões (Porto, Infinity, Múltiplo, ITI), Contas (Nubank, Itaú, VA) e 14 Categorias', icon: Server },
    { title: 'Autenticação & Switch de Usuário', desc: 'Alternância instantânea entre Wallace e Guilherme com simulação de invasor', icon: Smartphone }
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-850 p-5 rounded-2xl border border-blue-200/80 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
            Entrega Concluída
          </span>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">Sprint 1: Infraestrutura & Autenticação</h3>
        </div>
        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5" />
          100% Validado
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {deliverables.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 shadow-2xs"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.title}</h4>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
