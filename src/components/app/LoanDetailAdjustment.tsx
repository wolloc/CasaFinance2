import { ArrowLeft } from 'lucide-react';
import { LoanChargesAdjustment } from './LoanChargesAdjustment.js';
import { LoanPaymentAdjustment } from './LoanPaymentAdjustment.js';
import { LoanScheduledPayment } from './LoanScheduledPayment.js';
import { LoanScheduleSummary } from './LoanScheduleSummary.js';
import { LoanPayerPlanEditor } from './LoanPayerPlanEditor.js';

export function LoanDetailAdjustment({loanId,onBack}:{loanId:string;onBack:()=>void}){
 return <section className="space-y-4">
  <button type="button" onClick={onBack} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar</button>
  <div><h2 className="text-xl font-black">Empréstimo</h2><p className="mt-1 text-sm text-slate-400">Acompanhe custos e registre pagamentos deste contrato sem transformar principal em renda ou despesa nova.</p></div>
  <LoanPayerPlanEditor loanId={loanId}/>
  <LoanScheduleSummary loanId={loanId}/>
  <LoanScheduledPayment loanId={loanId}/>
  <LoanChargesAdjustment initialLoanId={loanId}/>
  <details className="rounded-2xl border border-slate-800 bg-slate-900/50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-400">Pagamento avulso, multa ou ajuste</summary><div className="border-t border-slate-800 p-3"><LoanPaymentAdjustment initialLoanId={loanId}/></div></details>
 </section>;
}
