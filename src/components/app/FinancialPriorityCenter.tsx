import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { AttentionItem } from '../../finance/financialDashboard.js';
import { ProjectionReviewCenter } from './ProjectionReviewCenter.js';

const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));

export type AttentionNavigationAction=
  | {kind:'navigate';destination:'expenses'|'invoices'|'income'}
  | {kind:'recurring-expense';occurrenceId:string}
  | {kind:'overdue-commitment';commitmentKey:string}
  | {kind:'income-receipt';moneyMovementId:string}
  | {kind:'invoice-payment';invoiceId:string;amount:number}
  | {kind:'invoice-coverage-risk';invoiceId:string;amount:number}
  | {kind:'card-over-limit';cardId:string;amount:number}
  | {kind:'overdraft-account';accountId:string;amount:number}
  | {kind:'negative-projection';amount:number}
  | {kind:'member-settlement-schedule';scheduleId:string}
  | {kind:'third-party-obligation';obligationId:string;amount:number;direction:'payable'|'receivable'};

const actionFor=(item:AttentionItem):AttentionNavigationAction|null=>{
  if(item.attention_type==='recurring_expense_due'&&item.entity_type==='recurring_occurrence')return {kind:'recurring-expense',occurrenceId:item.entity_id};
  if(item.attention_type==='overdue_commitment'&&item.entity_type==='commitment'&&item.attention_key.startsWith('commitment:'))return {kind:'overdue-commitment',commitmentKey:item.attention_key.slice('commitment:'.length)};
  if(item.attention_type==='delayed_expected_income'&&item.entity_type==='money_movement')return {kind:'income-receipt',moneyMovementId:item.entity_id};
  if(item.attention_type==='overdue_invoice'&&item.entity_type==='invoice')return {kind:'invoice-payment',invoiceId:item.entity_id,amount:Number(item.amount)};
  if(item.attention_type==='card_coverage_risk'&&item.entity_type==='invoice')return {kind:'invoice-coverage-risk',invoiceId:item.entity_id,amount:Number(item.amount)};
  if(item.attention_type==='card_over_limit'&&item.entity_type==='card')return {kind:'card-over-limit',cardId:item.entity_id,amount:Number(item.amount)};
  if(item.attention_type==='overdraft_in_use'&&item.entity_type==='account')return {kind:'overdraft-account',accountId:item.entity_id,amount:Number(item.amount)};
  if(item.attention_type==='negative_projection'&&item.entity_type==='household')return {kind:'negative-projection',amount:Number(item.amount)};
  if(item.attention_type==='overdue_member_settlement'&&item.entity_type==='member_settlement_schedule')return {kind:'member-settlement-schedule',scheduleId:item.entity_id};
  if((item.attention_type==='overdue_payable'||item.attention_type==='overdue_receivable')&&item.entity_type==='obligation')return {kind:'third-party-obligation',obligationId:item.entity_id,amount:Number(item.amount),direction:item.attention_type==='overdue_payable'?'payable':'receivable'};
  if(item.recommended_action==='expenses'||item.recommended_action==='invoices'||item.recommended_action==='income')return {kind:'navigate',destination:item.recommended_action};
  return null;
};

export function FinancialPriorityCenter({items,onNavigate}:{items:AttentionItem[];onNavigate?:(action:AttentionNavigationAction)=>void}){
  return <section aria-labelledby="atencao"><h2 id="atencao" className="mb-3 flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-amber-400"/>Precisa de atenção</h2>
    {items.length===0?<p className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">Nenhuma situação acionável agora.</p>:<div className="space-y-3">{items.map((item,index)=>{const action=actionFor(item);const label=item.attention_type==='recurring_expense_due'?'Resolver esta conta':item.attention_type==='overdue_commitment'?'Resolver este gasto':item.attention_type==='delayed_expected_income'?'Revisar esta entrada':item.attention_type==='overdue_invoice'?'Registrar pagamento desta fatura':item.attention_type==='card_coverage_risk'?'Revisar cobertura desta fatura':item.attention_type==='card_over_limit'?'Revisar este cartão':item.attention_type==='overdraft_in_use'?'Revisar esta conta':item.attention_type==='negative_projection'?'Revisar plano de cobertura':item.attention_type==='overdue_member_settlement'?'Resolver este acerto':item.attention_type==='overdue_payable'?'Registrar pagamento':item.attention_type==='overdue_receivable'?'Registrar recebimento':item.action_label;return <article key={item.attention_key} className={`rounded-2xl border p-4 ${item.severity==='red'?'border-rose-900/70 bg-rose-950/20':'border-amber-900/60 bg-amber-950/10'}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-slate-400">Prioridade {index+1}</span><h3 className={item.severity==='red'?'font-bold text-rose-200':'font-bold text-amber-200'}>{item.title}</h3></div><p className="mt-2 text-sm text-slate-300">{item.priority_reason}</p>{item.due_date&&<p className="mt-1 text-xs text-slate-500">Data: {item.due_date}</p>}</div>{Number(item.amount)>0&&<strong className="whitespace-nowrap text-sm">{money(item.amount)}</strong>}</div>
      {action&&label&&<button type="button" onClick={()=>onNavigate?.(action)} className="mt-3 flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-bold text-blue-200">{label}<ArrowRight className="h-4 w-4"/></button>}
    </article>})}</div>}
    {items.length>1&&<p className="mt-2 text-xs text-slate-500">O Casa ordena primeiro o que combina maior gravidade, vencimento e impacto financeiro. A ordem não paga, transfere nem corrige nada sozinha.</p>}
    <ProjectionReviewCenter onNavigate={onNavigate}/>
  </section>;
}
