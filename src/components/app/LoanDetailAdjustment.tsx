import { ArrowLeft } from 'lucide-react';
import { LoanChargesAdjustment } from './LoanChargesAdjustment.js';
import { LoanPaymentAdjustment } from './LoanPaymentAdjustment.js';
import { LoanScheduleSummary } from './LoanScheduleSummary.js';

export function LoanDetailAdjustment({loanId,onBack}:{loanId:string;onBack:()=>void}){
 return <section className="space-y-4">
  <button type="button" onClick={onBack} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar</button>
  <div><h2 className="text-xl font-black">Empréstimo</h2><p className="mt-1 text-sm text-slate-400">Acompanhe custos e registre pagamentos deste contrato sem transformar principal em renda ou despesa nova.</p></div>
  <LoanScheduleSummary loanId={loanId}/>
  <LoanChargesAdjustment initialLoanId={loanId}/>
  <LoanPaymentAdjustment initialLoanId={loanId}/>
 </section>;
}
