import { LoaderCircle } from 'lucide-react';

export function FinancialListState({
  kind,
  title,
  description,
  onRetry,
}:{kind:'loading'|'error'|'empty';title?:string;description?:string;onRetry?:()=>void}){
  if(kind==='loading')return <div role="status" aria-label="Carregando" className="flex min-h-24 items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/25"><LoaderCircle className="h-5 w-5 animate-spin text-blue-300"/></div>;
  if(kind==='error')return <div className="rounded-2xl border border-rose-900/70 bg-rose-950/25 p-4"><p role="alert" className="text-sm font-semibold text-rose-200">{title??'Não foi possível carregar.'}</p>{description&&<p className="mt-1 text-xs text-rose-200/75">{description}</p>}{onRetry&&<button type="button" onClick={onRetry} className="mt-3 min-h-10 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button>}</div>;
  return <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center"><p className="text-sm font-semibold text-slate-300">{title??'Nada por aqui ainda.'}</p>{description&&<p className="mt-1 text-xs text-slate-400">{description}</p>}</div>;
}
