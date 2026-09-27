import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props={
 label:string;
 open:boolean;
 onToggle:()=>void;
 onClose:()=>void;
 onPrevious:()=>void;
 onNext:()=>void;
 previousDisabled?:boolean;
 nextDisabled?:boolean;
 customRange?:boolean;
 allowCustomRange?:boolean;
 monthValue:string;
 monthAriaLabel:string;
 monthMin?:string;
 onMonthChange:(value:string)=>void;
 rangeStart?:string;
 rangeEnd?:string;
 rangeReady?:boolean;
 onRangeStartChange?:(value:string)=>void;
 onRangeEndChange?:(value:string)=>void;
 onUseMonth?:()=>void;
 onUseCustomRange?:()=>void;
 onUseCurrentMonth?:()=>void;
 pickerTitle:string;
 pickerDescription:string;
 helperText?:string;
};

export function FinancialPeriodNavigator({
 label,open,onToggle,onClose,onPrevious,onNext,previousDisabled=false,nextDisabled=false,
 customRange=false,allowCustomRange=false,monthValue,monthAriaLabel,monthMin,onMonthChange,
 rangeStart='',rangeEnd='',rangeReady=true,onRangeStartChange,onRangeEndChange,onUseMonth,onUseCustomRange,onUseCurrentMonth,
 pickerTitle,pickerDescription,helperText
}:Props){
 return <div className="relative" aria-label="Período de referência">
  <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5">
   <button type="button" aria-label="Mês anterior" disabled={previousDisabled} onClick={onPrevious} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-5 w-5"/></button>
   <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl text-center hover:bg-slate-900">
    <span className="block text-base font-black capitalize text-slate-100">{label}</span>
    <span className="block text-xs text-slate-400">{helperText??(allowCustomRange?'Toque para escolher o período':'Toque para escolher o mês')}</span>
   </button>
   <button type="button" aria-label="Mês seguinte" disabled={nextDisabled} onClick={onNext} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-5 w-5"/></button>
  </div>
  {open&&<div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
   <div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{pickerTitle}</strong><p className="mt-1 text-xs text-slate-500">{pickerDescription}</p></div><button type="button" aria-label="Fechar escolha de período" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800"><X className="h-4 w-4"/></button></div>
   {allowCustomRange&&<div className="mt-3 grid grid-cols-2 gap-2">
    <button type="button" onClick={onUseMonth} className={`min-h-10 rounded-xl border text-xs font-bold ${!customRange?'border-blue-500 bg-blue-500/15 text-blue-200':'border-slate-800 text-slate-400'}`}>Mês inteiro</button>
    <button type="button" onClick={onUseCustomRange} className={`min-h-10 rounded-xl border text-xs font-bold ${customRange?'border-blue-500 bg-blue-500/15 text-blue-200':'border-slate-800 text-slate-400'}`}><CalendarRange className="mr-1 inline h-4 w-4"/>Personalizado</button>
   </div>}
   {!customRange?<label className="mt-3 block text-xs font-semibold text-slate-400">Mês<input aria-label={monthAriaLabel} type="month" min={monthMin} value={monthValue} onChange={e=>onMonthChange(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label>:<div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">De<input type="date" value={rangeStart} onChange={e=>onRangeStartChange?.(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label><label className="text-xs text-slate-400">Até<input type="date" min={rangeStart} value={rangeEnd} onChange={e=>onRangeEndChange?.(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label></div>}
   <div className={`mt-3 grid gap-2 ${onUseCurrentMonth?'grid-cols-2':'grid-cols-1'}`}>{onUseCurrentMonth&&<button type="button" onClick={onUseCurrentMonth} className="min-h-11 rounded-xl border border-slate-700 text-xs font-bold text-slate-300"><CalendarRange className="mr-1 inline h-4 w-4"/>Mês atual</button>}<button type="button" disabled={customRange&&!rangeReady} onClick={onClose} className="min-h-11 rounded-xl bg-blue-600 text-sm font-bold disabled:opacity-40">Aplicar</button></div>
  </div>}
 </div>;
}
