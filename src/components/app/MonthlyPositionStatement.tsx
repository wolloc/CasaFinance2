import { CircleCheck, CircleDollarSign, ShieldAlert } from 'lucide-react';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
export type MonthlyCoverageState='covered'|'covered_by_expected_income'|'needs_resource_reallocation'|'needs_funding_plan';

export function MonthlyPositionStatement({
  opening,realizedIncome,expectedIncome,realizedOutflow,remainingOutflow,ending,currentAvailable,coverageState,coverageGap=0,reserveAndInvestments=0,benefitBalance=0,thirdPartyExpectedInflow=0,subjectLabel='Casa',periodMode='current',
}:{
  opening:number;realizedIncome:number;expectedIncome:number;realizedOutflow:number;remainingOutflow:number;ending:number;currentAvailable?:number|null;coverageState?:MonthlyCoverageState|null;coverageGap?:number;reserveAndInvestments?:number;benefitBalance?:number;investmentBalance?:number;thirdPartyExpectedInflow?:number;subjectLabel?:string;periodMode?:'current'|'future';
}){
 const available=currentAvailable??opening;
 const futurePeriod=periodMode==='future';
 const projectedIncome=expectedIncome+thirdPartyExpectedInflow;
 const coverageCopy=futurePeriod
  ?(ending<0?{title:'Este mês pede atenção',tone:'text-rose-300',panel:'border-rose-900/50 bg-rose-950/15',Icon:ShieldAlert}:{title:'Este mês está no caminho certo',tone:'text-emerald-300',panel:'border-emerald-900/50 bg-emerald-950/15',Icon:CircleCheck})
  :coverageState==='covered'?{title:'Estamos tranquilos neste mês',tone:'text-emerald-300',panel:'border-emerald-900/50 bg-emerald-950/15',Icon:CircleCheck}
  :coverageState==='covered_by_expected_income'?{title:'O mês fecha contando com o que ainda entra',tone:'text-blue-300',panel:'border-blue-900/50 bg-blue-950/15',Icon:CircleDollarSign}
  :coverageState==='needs_resource_reallocation'?{title:'Vamos precisar mexer em outros recursos',tone:'text-amber-300',panel:'border-amber-900/50 bg-amber-950/15',Icon:ShieldAlert}
  :coverageState==='needs_funding_plan'?{title:'Precisamos nos organizar neste mês',tone:'text-rose-300',panel:'border-rose-900/50 bg-rose-950/15',Icon:ShieldAlert}
  :ending<0?{title:'Precisamos nos organizar neste mês',tone:'text-rose-300',panel:'border-rose-900/50 bg-rose-950/15',Icon:ShieldAlert}:{title:'O mês está no caminho certo',tone:'text-emerald-300',panel:'border-emerald-900/50 bg-emerald-950/15',Icon:CircleCheck};
 const CoverageIcon=coverageCopy.Icon;
 return <article className={`rounded-[2rem] border p-5 ${coverageCopy.panel}`}>
  <div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950/45 ${coverageCopy.tone}`}><CoverageIcon className="h-4 w-4"/></span><p className={`font-black ${coverageCopy.tone}`}>{coverageCopy.title}</p></div>
  <div className="mt-5"><p className="text-xs text-slate-500">{futurePeriod?`${subjectLabel} pode terminar este mês com`:`Se nada mudar, ${subjectLabel.toLowerCase()} pode terminar o mês com`}</p><strong className={`mt-1 block text-4xl tracking-tight ${ending<0?'text-rose-300':'text-white'}`}>{money(ending)}</strong></div>
  <div className="mt-5 rounded-2xl bg-slate-950/45 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Posição inicial do mês</p><strong className="mt-1 block text-base text-slate-100">{money(opening)}</strong><p className="mt-1 text-[11px] text-slate-500">Saldo disponível no início do acompanhamento deste mês.</p></div>
  <div className="mt-3 grid grid-cols-2 gap-2">
   <div className="rounded-xl bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">Efetivo · entrou</p><strong className="mt-1 block text-sm text-emerald-200">+ {money(realizedIncome)}</strong></div>
   <div className="rounded-xl bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-rose-400/80">Efetivo · saiu</p><strong className="mt-1 block text-sm text-rose-200">− {money(realizedOutflow)}</strong></div>
   <div className="rounded-xl bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/80">Ainda entra</p><strong className="mt-1 block text-sm text-emerald-200">+ {money(projectedIncome)}</strong>{thirdPartyExpectedInflow>0&&<p className="mt-1 text-[10px] text-cyan-300/80">inclui {money(thirdPartyExpectedInflow)} de terceiros</p>}</div>
   <div className="rounded-xl bg-slate-950/45 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-rose-400/80">Ainda sai</p><strong className="mt-1 block text-sm text-rose-200">− {money(remainingOutflow)}</strong></div>
  </div>
  {!futurePeriod&&reserveAndInvestments>0&&<p className="mt-2 rounded-xl bg-slate-950/45 px-3 py-2 text-xs text-slate-400">Reserva e investimentos: {money(reserveAndInvestments)} à parte, para um último recurso.</p>}
  <p className="mt-4 text-xs text-slate-500">O efetivo mostra o que já aconteceu. A projeção mostra o que ainda está previsto; novos lançamentos podem mudar o fechamento.</p>
  {coverageState==='needs_funding_plan'&&coverageGap>0&&<p className="mt-3 rounded-xl bg-rose-950/30 p-3 text-xs text-rose-200">Ainda faltam {money(coverageGap)} para cobrir os compromissos conhecidos.</p>}
  {coverageState==='needs_resource_reallocation'&&reserveAndInvestments>0&&<p className="mt-3 rounded-xl bg-amber-950/25 p-3 text-xs text-amber-100">Existem {money(reserveAndInvestments)} em reserva e investimentos que podem ser considerados na cobertura, sem entrar automaticamente no dinheiro para movimentar.</p>}
 </article>;
}
