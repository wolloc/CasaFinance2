import type { SupabaseClient } from '@supabase/supabase-js';

export type UpcomingFinancialEvent={
  key:string;
  date:string;
  kind:'income'|'commitment'|'invoice'|'settlement';
  direction:'in'|'out'|'neutral';
  title:string;
  amount:number;
  card_id:string|null;
  payer_member_id:string|null;
  receiver_member_id:string|null;
};

type CommitmentRow={
  commitment_key:string;
  source_type:string;
  source_invoice_id:string|null;
  financial_date:string;
  remaining_amount:string|number;
  description:string;
};

type InvoiceRow={
  invoice_id:string;
  card_id:string;
  due_date:string;
  remaining_amount:string|number;
  state:string;
};

const addDays=(date:string,days:number)=>{
  const value=new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
};

export async function listUpcomingFinancialEvents(client:SupabaseClient,householdId:string,fromDate:string,days=7,memberId?:string):Promise<UpcomingFinancialEvent[]>{
  const throughDate=addDays(fromDate,days);
  const incomeRequest=memberId
    ?client.from('financial_member_true_income_positions')
      .select('money_movement_id,movement_date,reliable_remaining_amount,state,member_id')
      .eq('household_id',householdId)
      .eq('member_id',memberId)
      .eq('state','projected')
      .gte('movement_date',fromDate)
      .lte('movement_date',throughDate)
      .gt('reliable_remaining_amount',0)
      .order('movement_date')
    :client.from('financial_true_income_positions')
      .select('money_movement_id,movement_date,reliable_remaining_amount,state')
      .eq('household_id',householdId)
      .eq('state','projected')
      .gte('movement_date',fromDate)
      .lte('movement_date',throughDate)
      .gt('reliable_remaining_amount',0)
      .order('movement_date');

  const [commitments,incomes,invoices,schedules,cards]=await Promise.all([
    client.from('financial_commitment_positions')
      .select('commitment_key,source_type,source_invoice_id,financial_date,remaining_amount,description')
      .eq('household_id',householdId)
      .gte('financial_date',fromDate)
      .lte('financial_date',throughDate)
      .gt('remaining_amount',0)
      .in('commitment_state',['forecast','confirmed'])
      .order('financial_date'),
    incomeRequest,
    client.from('financial_card_invoice_positions')
      .select('invoice_id,card_id,due_date,remaining_amount,state')
      .eq('household_id',householdId)
      .gte('due_date',fromDate)
      .lte('due_date',throughDate)
      .gt('remaining_amount',0)
      .neq('state','cancelled')
      .order('due_date'),
    client.from('member_settlement_schedules')
      .select('id,due_date,amount,payer_member_id,receiver_member_id,state')
      .eq('household_id',householdId)
      .eq('state','scheduled')
      .gte('due_date',fromDate)
      .lte('due_date',throughDate)
      .order('due_date'),
    client.from('cards').select('id,name').eq('household_id',householdId).is('deactivated_at',null),
  ]);

  for(const response of[commitments,incomes,invoices,schedules,cards])if(response.error)throw response.error;

  let commitmentRows=(commitments.data??[]) as CommitmentRow[];
  const invoiceRows=(invoices.data??[]) as InvoiceRow[];
  const cardNames=new Map((cards.data??[]).map(card=>[card.id as string,card.name as string]));
  const memberAmounts=new Map<string,number>();

  if(memberId){
    if(commitmentRows.length>0){
      const responsibility=await client.from('financial_member_commitment_responsibility_positions')
        .select('commitment_key,remaining_responsibility_amount')
        .eq('household_id',householdId)
        .eq('member_id',memberId)
        .in('commitment_key',commitmentRows.map(row=>row.commitment_key));
      if(responsibility.error)throw responsibility.error;
      for(const row of responsibility.data??[])memberAmounts.set(row.commitment_key,(memberAmounts.get(row.commitment_key)??0)+Number(row.remaining_responsibility_amount??0));
      commitmentRows=commitmentRows.filter(row=>(memberAmounts.get(row.commitment_key)??0)>0);
    }
  }

  const events:UpcomingFinancialEvent[]=[];
  for(const income of incomes.data??[]){
    events.push({
      key:`income:${income.money_movement_id}`,
      date:income.movement_date,
      kind:'income',
      direction:'in',
      title:'Entrada confiável prevista',
      amount:Number(income.reliable_remaining_amount??0),
      card_id:null,payer_member_id:null,receiver_member_id:null,
    });
  }

  const commitmentsByInvoice=new Map<string,CommitmentRow[]>();
  for(const row of commitmentRows){
    if(row.source_invoice_id){
      const list=commitmentsByInvoice.get(row.source_invoice_id)??[];
      list.push(row);
      commitmentsByInvoice.set(row.source_invoice_id,list);
      continue;
    }
    events.push({
      key:row.commitment_key,
      date:row.financial_date,
      kind:'commitment',
      direction:'out',
      title:row.description,
      amount:memberId?(memberAmounts.get(row.commitment_key)??0):Number(row.remaining_amount),
      card_id:null,payer_member_id:null,receiver_member_id:null,
    });
  }

  for(const invoice of invoiceRows){
    const grouped=commitmentsByInvoice.get(invoice.invoice_id)??[];
    const amount=memberId
      ?grouped.reduce((sum,row)=>sum+(memberAmounts.get(row.commitment_key)??0),0)
      :Number(invoice.remaining_amount);
    if(amount<=0)continue;
    events.push({
      key:`invoice:${invoice.invoice_id}`,
      date:invoice.due_date,
      kind:'invoice',
      direction:'out',
      title:`Fatura ${cardNames.get(invoice.card_id)??'do cartão'}`,
      amount,
      card_id:invoice.card_id,
      payer_member_id:null,receiver_member_id:null,
    });
  }

  // If an installment is linked to an invoice outside the window or the invoice
  // is not materialized in the canonical invoice read, keep the commitment visible.
  const invoiceIds=new Set(invoiceRows.map(row=>row.invoice_id));
  for(const [invoiceId,grouped] of commitmentsByInvoice){
    if(invoiceIds.has(invoiceId))continue;
    for(const row of grouped){
      events.push({
        key:row.commitment_key,
        date:row.financial_date,
        kind:'commitment',
        direction:'out',
        title:row.description,
        amount:memberId?(memberAmounts.get(row.commitment_key)??0):Number(row.remaining_amount),
        card_id:null,payer_member_id:null,receiver_member_id:null,
      });
    }
  }

  for(const schedule of schedules.data??[]){
    const payer=schedule.payer_member_id as string;
    const receiver=schedule.receiver_member_id as string;
    if(memberId&&payer!==memberId&&receiver!==memberId)continue;
    events.push({
      key:`settlement:${schedule.id}`,
      date:schedule.due_date,
      kind:'settlement',
      direction:memberId?(payer===memberId?'out':'in'):'neutral',
      title:memberId?(payer===memberId?'Acerto que você pretende pagar':'Acerto que você pretende receber'):'Acerto entre membros',
      amount:Number(schedule.amount??0),
      card_id:null,payer_member_id:payer,receiver_member_id:receiver,
    });
  }

  return events.sort((a,b)=>a.date.localeCompare(b.date)||({invoice:0,commitment:1,income:2,settlement:3}[a.kind]-{invoice:0,commitment:1,income:2,settlement:3}[b.kind]));
}
