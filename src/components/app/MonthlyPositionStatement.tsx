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
  const effectiveAvailable=currentAvailable??opening;
  const coverageCopy=coverageState==='covered'
    ?{title:'Estamos tranquilos neste mês',detail:'Com o que já temos hoje, os compromissos conhecidos ficam cobertos.',tone:'text-emerald-300',panel:'border-emerald-900/50 bg-emerald-950/15',Icon:CircleCheck}
    :coverageState==='covered_by_expected_income'
      ?{title:'O mês fecha, contando com o que ainda entra',detail:'O dinheiro de hoje não cobre tudo sozinho, mas as entradas previstas completam o mês.',tone:'text-blue-300',panel:'border-blue-900/50 bg-blue-950/15',Icon:CircleDollarSign}
      :coverageState==='needs_resource_reallocation'
        ?{title:'Vamos precisar mexer em outros recursos',detail:'O caixa e as entradas previstas não cobrem tudo sozinhos. Reserva ou investimento podem ajudar, mas continuam separados do dinheiro do dia a dia.',tone:'text-amber-300',panel:'border-amber-900/50 bg-amber-950/15',Icon:Landmark}
        :coverageState==='needs_funding_plan'
          ?{title:'Precisamos nos organizar neste mês',detail:`Mesmo contando com o que ainda entra, faltam ${money(Math.max(0,coverageGap))} para cobrir o que já conhecemos.`,tone:'text-rose-300',panel:'border-rose-900/50 bg-rose-950/15',Icon:ShieldAlert}
          :ending<0
            ?{title:'Precisamos nos organizar neste mês',detail:'A projeção termina negativa com o que já sabemos hoje.',tone:'text-rose-300',panel:'border-rose-900/50 bg-rose-950/15',Icon:ShieldAlert}
            :{title:'O mês está no caminho certo',detail:'Com o que já sabemos hoje, a projeção termina positiva.',tone:'text-emerald-300',panel:'border-emerald-900/50 bg-emerald-950/15',Icon:CircleCheck};
  const CoverageIcon=coverageCopy.Icon;

  return <div className="space-y-3">
    <article className={`rounded-[1.6rem] border p-4 ${coverageCopy.panel}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950/45 ${coverageCopy.tone}`}><CoverageIcon className="h-4 w-4"/></span>
        <div>
          <p className={`font-black ${coverageCopy.tone}`}>{coverageCopy.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{coverageCopy.detail}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        Temos <strong className="text-white">{money(effectiveAvailable)}</strong> disponíveis hoje.
        {' '}Ainda devem entrar <strong className="text-emerald-200">{money(expectedIncome)}</strong> e sair <strong className="text-rose-200">{money(remainingOutflow)}</strong>.
      </p>

      <div className="mt-4 rounded-2xl bg-slate-950/45 p-4">
        <p className="text-xs text-slate-400">Se tudo acontecer como previsto, terminamos o mês com</p>
        <strong className={`mt-1 block text-3xl ${ending<0?'text-rose-300':'text-white'}`}>{money(ending)}</strong>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Quanto temos hoje?</p>
          <strong className="mt-1 block text-sm text-slate-100">{money(effectiveAvailable)}</strong>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">O que ainda acontece?</p>
          <span className="mt-1 block text-xs font-bold text-emerald-200">+ {money(expectedIncome)}</span>
          <span className="block text-xs font-bold text-rose-200">− {money(remainingOutflow)}</span>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Como devemos terminar?</p>
          <strong className={`mt-1 block text-sm ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong>
        </div>
      </div>

      {coverageState==='needs_resource_reallocation'&&reserveAndInvestments>0&&<p className="mt-3 text-xs text-amber-100/80">Temos {money(reserveAndInvestments)} em reserva + investimentos, mas esse valor não entra automaticamente no caixa do mês.</p>}
    </article>

    <details className="group rounded-2xl border border-slate-800 bg-slate-900/30">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <WalletCards className="h-4 w-4 text-blue-300"/>
          <div><p className="font-bold text-slate-200">Entender essa previsão</p><p className="text-[11px] text-slate-500">Ver como chegamos a esse valor</p></div>
        </div>
        <strong className={ending<0?'text-rose-300':'text-slate-100'}>{money(ending)}</strong>
      </summary>
      <div className="space-y-2 border-t border-slate-800 px-4 py-3 text-sm">
        <div className="flex justify-between gap-3"><span className="text-slate-500">Saldo na abertura do mês</span><strong>{money(opening)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-emerald-300">+ Entradas já realizadas</span><strong className="text-emerald-200">{money(realizedIncome)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-blue-300">+ Entradas previstas ainda esperadas</span><strong className="text-blue-200">{money(expectedIncome)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-rose-300">− Saídas/compromissos já realizados</span><strong className="text-rose-200">{money(realizedOutflow)}</strong></div>
        <div className="flex justify-between gap-3"><span className="text-amber-300">− O que ainda deve sair</span><strong className="text-amber-200">{money(remainingOutflow)}</strong></div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-800 pt-3"><div><p className="text-xs text-slate-500">Posição projetada no fim do mês</p><p className="mt-1 text-[11px] text-slate-600">Previsto não é realizado; o valor muda conforme novos fatos são confirmados.</p></div><strong className={`whitespace-nowrap text-xl ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong></div>
      </div>
    </details>
  </div>;
}
