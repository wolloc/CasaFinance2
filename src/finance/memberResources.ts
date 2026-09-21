import type { SupabaseClient } from '@supabase/supabase-js';

export type MemberResourcePosition={
  account_id:string;
  name:string;
  type:string;
  resource_restriction:string|null;
  current_balance:number;
  attributed_amount:number;
  allocation_ratio:number;
  is_restricted:boolean;
  is_investment:boolean;
};

export async function listMemberResourcePositions(client:SupabaseClient,householdId:string,memberId:string):Promise<MemberResourcePosition[]>{
  const [balances,allocations]=await Promise.all([
    client.from('financial_account_balances')
      .select('account_id,name,type,resource_restriction,current_balance,is_restricted,is_investment')
      .eq('household_id',householdId)
      .order('name'),
    client.from('financial_account_member_allocations')
      .select('account_id,allocation_ratio,is_valid')
      .eq('household_id',householdId)
      .eq('member_id',memberId)
      .eq('is_valid',true),
  ]);
  if(balances.error)throw balances.error;
  if(allocations.error)throw allocations.error;
  const ratioByAccount=new Map((allocations.data??[]).map(row=>[row.account_id,Number(row.allocation_ratio)]));
  return (balances.data??[]).flatMap(row=>{
    const allocationRatio=ratioByAccount.get(row.account_id);
    if(allocationRatio==null)return[];
    const currentBalance=Number(row.current_balance??0);
    return[{
      account_id:row.account_id,
      name:row.name,
      type:row.type,
      resource_restriction:row.resource_restriction,
      current_balance:currentBalance,
      attributed_amount:currentBalance*allocationRatio,
      allocation_ratio:allocationRatio,
      is_restricted:Boolean(row.is_restricted),
      is_investment:Boolean(row.is_investment),
    }];
  });
}
