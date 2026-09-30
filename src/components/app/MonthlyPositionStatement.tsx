import { CircleCheck, CircleDollarSign, Landmark, ShieldAlert, WalletCards } from 'lucide-react';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);

export type MonthlyCoverageState='covered'|'covered_by_expected_income'|'needs_resource_reallocation'|'needs_funding_plan';

export function MonthlyPositionStatement({
  opening,
  realizedIncome,
  expectedIncome,
  realizedOutflow,
  remainingOutflow,
  ending,
  currentAvailable,
  coverageState,
  coverageGap=0,
  reserveAndInvestments=0,
}:{
  opening:number;
  realizedIncome:number;
  expectedIncome:number;
  realizedOutflow:number;
  remainingOutflow:number;
  ending:number;
  currentAvailable?:number|null;
  coverageState?:MonthlyCoverageState|null;
  coverageGap?:number;
  reserveAndInvestments?:number;
}){
  const coverageCopy=coverageState==='covered'
    ?{title:'O que já está disponível cobre o mês',detail:'Os recursos líquidos atuais cobrem os compromissos conhecidos.',tone:'text-emerald-300',Icon:CircleCheck}
    :coverageState==='covered_by_expected_income'
      ?{title:'O mês fecha com as entradas esperadas',detail:'O caixa de agora não cobre tudo sozinho, mas as entradas confiáveis previstas completam a cobertura.',tone:'text-blue-300',Icon:CircleDollarSign}
      :coverageState==='needs_resource_reallocation'
        ?{title:'Vai precisar puxar outro recurso',detail:'Caixa e entradas previstas não cobrem tudo. Reserva ou investimento podem completar a cobertura.',tone:'text-amber-300',Icon:Landmark}
        :coverageState==='needs_funding_plan'
          ?{title:'Ainda falta cobertura para o mês',detail:`Mesmo considerando as entradas previstas, ainda faltam ${money(Math.max(0,coverageGap))}.`,tone:'text-rose-300',Icon:ShieldAlert}
          :null;
  const CoverageIcon=coverageCopy?.Icon;

  return <div className="space-y-3">
    {coverageCopy&&CoverageIcon&&<article className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
      <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 ${coverageCopy.tone}`}><CoverageIcon className="h-4 w-4"/></span><div><p className={`font-bold ${coverageCopy.tone}`}>{coverageCopy.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{coverageCopy.detail}</p></div></div>
      {currentAvailable!=null&&<div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3 text-xs"><span className="text-slate-500">Disponível agora</span><strong className="text-slate-200">{money(currentAvailable)}</strong></div>}
      {coverageState==='needs_resource_reallocation'&&reserveAndInvestments>0&&<div className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-500">Reserva + investimentos</span><strong className="text-amber-200">{money(reserveAndInvestments)}</strong></div>}
    </article>}

    <details className="group rounded-2xl border border-slate-800 bg-slate-900/35" open>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-blue-300"/><div><p className="font-bold text-slate-200">Extrato do mês</p><p className="text-[11px] text-slate-500">Da abertura à posição projetada</p></div></div>
        <strong className={ending<0?'text-rose-300':'text-slate-100'}>{money(ending)}</strong>
      </summary>
      <div className="space-y-2 border-t border-slate-800 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3"><span className="text-slate-500">Saldo na abertura do mês</span><strong>{money(opening)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-emerald-300">+ Entradas já realizadas</span><strong className="text-emerald-200">{money(realizedIncome)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-blue-300">+ Entradas confiáveis ainda esperadas</span><strong className="text-blue-200">{money(expectedIncome)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-rose-300">− Saídas/compromissos já realizados</span><strong className="text-rose-200">{money(realizedOutflow)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-amber-300">− O que ainda deve sair</span><strong className="text-amber-200">{money(remainingOutflow)}</strong></div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-800 pt-3"><div><p className="text-xs text-slate-500">Posição projetada no fim do mês</p><p className="mt-1 text-[11px] text-slate-600">Previsto não é realizado; o valor muda conforme novos fatos são confirmados.</p></div><strong className={`whitespace-nowrap text-xl ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong></div>
      </div>
    </details>
  </div>;
}
