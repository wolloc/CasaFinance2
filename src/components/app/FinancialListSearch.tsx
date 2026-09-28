import { Search, X } from 'lucide-react';

export function FinancialListSearch({
 value,onChange,placeholder,ariaLabel,resultText
}:{value:string;onChange:(value:string)=>void;placeholder:string;ariaLabel:string;resultText?:string}){
 return <div>
  <div className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3">
   <Search className="h-4 w-4 shrink-0 text-slate-500"/>
   <input aria-label={ariaLabel} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"/>
   {value&&<button type="button" aria-label="Limpar busca" onClick={()=>onChange('')} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200"><X className="h-4 w-4"/></button>}
  </div>
  {value&&resultText&&<p className="mt-2 text-xs text-slate-400">{resultText}</p>}
 </div>;
}
