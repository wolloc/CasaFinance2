import { AlertTriangle, ArrowRight, CircleCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { AttentionItem } from '../../finance/financialDashboard.js';
import { ProjectionReviewCenter } from './ProjectionReviewCenter.js';
import { FinancialSectionHeading, financialUi } from './FinancialSectionHeading.js';
import { IncomeReceiptAction } from './IncomeReceiptAction.js';

const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));

export type AttentionNavigationAction=
  | {kind:'navigate';destination:'expenses'|'invoices'|'income'}
  | {kind:'recurring-expense';occurrenceId:string}
  | {kind:'projection-recurring-review';occurrenceId:string}
  | {kind:'projection-expense-review';commitmentKey:string}
  | {kind:'overdue-commitment';commitmentKey:string}
  | {kind:'income-receipt';moneyMovementId:string}
  | {kind:'projection-income-review';moneyMovementId:string}
  | {kind:'invoice-payment';invoiceId:string;amount:number}
  | {kind:'invoice-coverage-risk';invoiceId:string;amount:number}
  | {kind:'projection-invoice-review';invoiceId:string}
  | {kind:'card-over-limit';cardId:string;amount:number}
  | {kind:'overdraft-account';accountId:string;amount:number}
  | {kind:'negative-projection';amount:number}
  | {kind:'member-settlement-schedule';scheduleId:string}
  | {kind:'third-party-obligation';obligationId:string;amount:number;direction:'payable'|'receivable'};

const actionFor=(item:AttentionItem):AttentionNavigationAction|null=>{
  if(item.attention_type==='recurring_expense_due'&&item.entity_type==='recurring_occurrence')return {kind:'recurring-expense',occurrenceId:item.entity_id};
  if(item.attention_type==='overdue_commitment'&&(item.entity_type==='commitment'||item.entity_type==='loan_schedule_item')&&item.attention_key.startsWith('commitment:'))return {kind:'overdue-commitment',commitmentKey:item.attention_key.slice('commitment:'.length)};
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

export function FinancialPriorityCenter({items,onNavigate,onResolved,children}:{items:AttentionItem[];onNavigate?:(action:AttentionNavigationAction)=>void;onResolved?:()=>void;children?:ReactNode}){
  const[activeIncomeMovementId,setActiveIncomeMovementId]=useState<string|null>(null);
  const attentionIncomeMovementIds=items.filter(item=>item.attention_type==='delayed_expected_income'&&item.entity_type==='money_movement').map(item=>item.entity_id);
  return <section aria-labelledby="atencao">
    <details open={items.some(item=>item.severity==='red')} className={`group ${financialUi.surface}`}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400"/><strong id="atencao" className="text-sm">Precisa de atenção</strong></div>
        <div className="flex items-center gap-2">{items.length>0?<span className="rounded-full bg-amber-950/50 px-2 py-1 text-[11px] font-bold text-amber-300">{items.length}</span>:<CircleCheck className="h-4 w-4 text-emerald-400"/>}<ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-open:rotate-90"/></div>
      </summary>
      <div className="space-y-2 border-t border-slate-800 px-3 py-3">
        {items.length===0?<p className="px-1 text-xs text-emerald-200">Nada urgente agora. O que pedir ação aparece aqui.</p>:items.map((item)=>{const action=actionFor(item);const label=item.attention_type==='recurring_expense_due'?'Resolver esta conta':item.attention_type==='overdue_commitment'?(item.entity_type==='loan_schedule_item'?'Ver empréstimo':'Resolver este gasto'):item.attention_type==='delayed_expected_income'?'Confirmar entrada':item.attention_type==='overdue_invoice'?'Registrar pagamento desta fatura':item.attention_type==='card_coverage_risk'?'Revisar cobertura desta fatura':item.attention_type==='card_over_limit'?'Revisar este cartão':item.attention_type==='overdraft_in_use'?'Revisar esta conta':item.attention_type==='negative_projection'?'Revisar plano de cobertura':item.attention_type==='overdue_member_settlement'?'Resolver este acerto':item.attention_type==='overdue_payable'?'Registrar pagamento':item.attention_type==='overdue_receivable'?'Registrar recebimento':item.action_label;return <article key={item.attention_key} className={`rounded-xl border px-3 py-3 ${item.severity==='red'?'border-rose-900/70 bg-rose-950/15':'border-amber-900/60 bg-amber-950/10'}`}>
          <div className="flex items-start gap-3"><span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity==='red'?'bg-rose-400':'bg-amber-400'}`}/><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-100">{item.title}</h3>{Number(item.amount)>0&&<strong className="whitespace-nowrap text-sm">{money(item.amount)}</strong>}</div><div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">{item.due_date&&<span className="rounded-full bg-slate-950/55 px-2 py-1">{item.attention_type.includes('overdue')?'Venceu':'Até'} · {shortDate(item.due_date)}</span>}<span className={`rounded-full px-2 py-1 ${item.severity==='red'?'bg-rose-950/40 text-rose-300':'bg-amber-950/35 text-amber-300'}`}>{item.severity==='red'?'Ação importante':'Vale conferir'}</span></div>{item.attention_type==='delayed_expected_income'&&item.entity_type==='money_movement'?<><button type="button" onClick={()=>setActiveIncomeMovementId(current=>current===item.entity_id?null:item.entity_id)} className="mt-2 flex min-h-9 items-center gap-1 text-xs font-bold text-emerald-300">{activeIncomeMovementId===item.entity_id?'Fechar confirmação':'Confirmar entrada'}<ArrowRight className={`h-4 w-4 transition-transform ${activeIncomeMovementId===item.entity_id?'rotate-90':''}`}/></button>{activeIncomeMovementId===item.entity_id&&<div className="mt-2"><IncomeReceiptAction initialMoneyMovementId={item.entity_id} onCompleted={()=>{setActiveIncomeMovementId(null);onResolved?.();}}/></div>}</>:action&&label?<button type="button" onClick={()=>onNavigate?.(action)} className="mt-2 flex min-h-9 items-center gap-1 text-xs font-bold text-blue-300">{label}<ArrowRight className="h-4 w-4"/></button>:null}</div></div>
        </article>})}
        <ProjectionReviewCenter onNavigate={onNavigate} excludeEntityIds={attentionIncomeMovementIds}/>
        {children}
      </div>
    </details>
  </section>;
}
