export function FinancialCategoryBreakdown({
 categories,total,tone='neutral',showBars=false,footer
}:{categories:Array<{name:string;amount:number}>;total:number;tone?:'income'|'expense'|'commitment'|'neutral';showBars?:boolean;footer?:string}){
 if(categories.length===0)return null;
 const toneClass=tone==='income'?'text-emerald-300':tone==='expense'?'text-rose-300':tone==='commitment'?'text-amber-300':'text-slate-200';
 const barClass=tone==='income'?'bg-emerald-400':tone==='expense'?'bg-rose-400':tone==='commitment'?'bg-amber-400':'bg-slate-500';
 const percentage=(value:number)=>total>0?Math.round(value/total*100):0;
 return <details className="mt-2 border-t border-slate-800 pt-2">
  <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-300"><span>Ver categorias</span><span className="text-[11px] font-normal text-slate-500">{categories.length}</span></summary>
  <div className="mt-3 space-y-3">{categories.map(category=><div key={category.name}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">{category.name}</span><strong className={`shrink-0 ${toneClass}`}>{category.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {percentage(category.amount)}%</strong></div>{showBars&&<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${barClass}`} style={{width:String(Math.max(0,Math.min(100,percentage(category.amount))))+'%'}}/></div>}</div>)}</div>
  {footer&&<p className="mt-3 text-[11px] text-slate-500">{footer}</p>}
 </details>;
}
