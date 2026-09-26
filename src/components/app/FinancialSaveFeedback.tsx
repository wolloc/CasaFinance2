import { CheckCircle2 } from 'lucide-react';

export function FinancialSaveFeedback({message}:{message:string}){
  return <p role="status" aria-live="polite" className="flex items-start gap-2 rounded-2xl border border-emerald-900/70 bg-emerald-950/25 p-3 text-sm text-emerald-100">
    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"/>
    <span>{message}</span>
  </p>;
}
