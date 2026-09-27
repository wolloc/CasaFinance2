import type { SupabaseClient } from '@supabase/supabase-js';

type ResourceIdentity={
  institution:string|null;
  owner_member_ids:string[];
};

async function resourceIdentityByAccount(client:SupabaseClient,householdId:string){
  const [accounts,ownerships]=await Promise.all([
    client.from('accounts').select('id,institution,owner_member_id').eq('household_id',householdId).is('deactivated_at',null),
    client.from('account_ownerships').select('account_id,member_id').eq('household_id',householdId),
  ]);
  if(accounts.error)throw accounts.error;
  if(ownerships.error)throw ownerships.error;
  const ownersByAccount=new Map<string,string[]>();
  for(const row of ownerships.data??[]){
    const current=ownersByAccount.get(String(row.account_id))??[];
    ownersByAccount.set(String(row.account_id),[...current,String(row.member_id)]);
  }
  return new Map((accounts.data??[]).map(row=>{
    const fallback=row.owner_member_id?[String(row.owner_member_id)]:[];
    return[String(row.id),{
      institution:row.institution?String(row.institution):null,
      owner_member_ids:ownersByAccount.get(String(row.id))??fallback,
    } satisfies ResourceIdentity] as const;
  }));
}

export type HouseholdResourcePosition={
  account_id:string;
  name:string;
  type:string;
  institution:string|null;
  owner_member_ids:string[];
  resource_restriction:string|null;
  current_balance:number;
  is_restricted:boolean;
  is_investment:boolean;
};

export async function listHouseholdResourcePositions(client:SupabaseClient,householdId:string):Promise<HouseholdResourcePosition[]>{
  const [response,identityByAccount]=await Promise.all([
    client.from('financial_account_balances')
      .select('account_id,name,type,resource_restriction,current_balance,is_restricted,is_investment')
      .eq('household_id',householdId)
      .order('name'),
    resourceIdentityByAccount(client,householdId),
  ]);
  if(response.error)throw response.error;
  return (response.data??[]).map(row=>{
    const identity=identityByAccount.get(String(row.account_id));
    return{
      account_id:String(row.account_id),
      name:String(row.name),
      type:String(row.type),
      institution:identity?.institution??null,
      owner_member_ids:identity?.owner_member_ids??[],
      resource_restriction:row.resource_restriction?String(row.resource_restriction):null,
      current_balance:Number(row.current_balance??0),
      is_restricted:Boolean(row.is_restricted),
      is_investment:Boolean(row.is_investment),
    };
  });
}

export type MemberResourcePosition={
  account_id:string;
  name:string;
  type:string;
  institution:string|null;
  owner_member_ids:string[];
  resource_restriction:string|null;
  current_balance:number;
  attributed_amount:number;
  allocation_ratio:number;
  is_restricted:boolean;
  is_investment:boolean;
};

export async function listMemberResourcePositions(client:SupabaseClient,householdId:string,memberId:string):Promise<MemberResourcePosition[]>{
  const [balances,allocations,identityByAccount]=await Promise.all([
    client.from('financial_account_balances')
      .select('account_id,name,type,resource_restriction,current_balance,is_restricted,is_investment')
      .eq('household_id',householdId)
      .order('name'),
    client.from('financial_account_member_allocations')
      .select('account_id,allocation_ratio,is_valid')
      .eq('household_id',householdId)
      .eq('member_id',memberId)
      .eq('is_valid',true),
    resourceIdentityByAccount(client,householdId),
  ]);
  if(balances.error)throw balances.error;
  if(allocations.error)throw allocations.error;
  const ratioByAccount=new Map((allocations.data??[]).map(row=>[String(row.account_id),Number(row.allocation_ratio)]));
  return (balances.data??[]).flatMap(row=>{
    const accountId=String(row.account_id);
    const allocationRatio=ratioByAccount.get(accountId);
    if(allocationRatio==null)return[];
    const currentBalance=Number(row.current_balance??0);
    const identity=identityByAccount.get(accountId);
    return[{
      account_id:accountId,
      name:String(row.name),
      type:String(row.type),
      institution:identity?.institution??null,
      owner_member_ids:identity?.owner_member_ids??[],
      resource_restriction:row.resource_restriction?String(row.resource_restriction):null,
      current_balance:currentBalance,
      attributed_amount:currentBalance*allocationRatio,
      allocation_ratio:allocationRatio,
      is_restricted:Boolean(row.is_restricted),
      is_investment:Boolean(row.is_investment),
    }];
  });
}
