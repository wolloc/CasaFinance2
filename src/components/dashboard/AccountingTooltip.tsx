import React from 'react';
import { CircleHelp } from 'lucide-react';

const explanations = {
  'Saldo real': 'Saldos dos meios após somente movimentações efetivadas.',
  Projetado: 'Estimativa que soma previsões sem alterar o realizado.',
  'Origem do pagamento': 'Instrumento e rota por onde o dinheiro saiu.',
  'Financiado por': 'Membro cujos recursos próprios liquidaram o gasto.',
  'Responsabilidade econômica': 'Parcela que cada membro deve suportar, independente de quem comprou.'
} as const;

export type AccountingTerm = keyof typeof explanations;

export const AccountingTooltip: React.FC<{ term: AccountingTerm }> = ({ term }) => (
  <span className="group relative inline-flex">
    <button type="button" aria-label={`${term}: ${explanations[term]}`} className="rounded-full p-0.5 text-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <CircleHelp className="h-3.5 w-3.5" />
    </button>
    <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-52 rounded-xl border border-slate-700 bg-slate-950 p-2 text-[10px] font-medium normal-case leading-relaxed text-slate-200 shadow-xl group-hover:block group-focus-within:block">
      <strong className="text-white">{term}:</strong> {explanations[term]}
    </span>
  </span>
);
