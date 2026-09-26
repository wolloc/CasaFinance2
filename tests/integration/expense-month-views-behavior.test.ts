import test from 'node:test';
import assert from 'node:assert/strict';
import { listEconomicMonthExpenses } from '../../src/finance/expenseMonthViews.js';

type Response={data:unknown[]|null;error:unknown|null};
type Call={table:string;method:string;column?:string;value?:unknown};

class FakeQuery {
  constructor(private readonly table:string,private readonly response:Response,private readonly calls:Call[]){}
  select(value:string){this.calls.push({table:this.table,method:'select',value});return this;}
  eq(column:string,value:unknown){this.calls.push({table:this.table,method:'eq',column,value});return this;}
  is(column:string,value:unknown){this.calls.push({table:this.table,method:'is',column,value});return this;}
  gte(column:string,value:unknown){this.calls.push({table:this.table,method:'gte',column,value});return this;}
  lt(column:string,value:unknown){this.calls.push({table:this.table,method:'lt',column,value});return this;}
  in(column:string,value:unknown){this.calls.push({table:this.table,method:'in',column,value});return this;}
  order(column:string,value:unknown){this.calls.push({table:this.table,method:'order',column,value});return this;}
  then<TResult1=Response,TResult2=never>(onfulfilled?:((value:Response)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:unknown)=>TResult2|PromiseLike<TResult2>)|null){
    return Promise.resolve(this.response).then(onfulfilled,onrejected);
  }
}

function fakeClient(responses:Record<string,Response[]>){
  const calls:Call[]=[];
  return {
    calls,
    client:{
      from(table:string){
        const response=responses[table]?.shift();
        if(!response)throw new Error(`Missing fake response for ${table}`);
        return new FakeQuery(table,response,calls);
      },
    },
  };
}

test('Gastos realizados uses canonical member-attributed amount and legacy gross fallback only for missing position',async()=>{
  const fake=fakeClient({
    transactions:[{data:[
      {id:'mixed',description:'Jantar',amount:'100.00',transaction_date:'2026-09-10',economic_state:'realized',category_id:null,category:null},
      {id:'legacy',description:'Legado',amount:'75.00',transaction_date:'2026-09-09',economic_state:'realized',category_id:null,category:null},
      {id:'third-party',description:'Terceiro',amount:'40.00',transaction_date:'2026-09-08',economic_state:'realized',category_id:null,category:null},
    ],error:null}],
    financial_transaction_positions:[{data:[
      {transaction_id:'mixed',household_economic_amount:'60.00',economic_state:'realized'},
      {transaction_id:'third-party',household_economic_amount:'0.00',economic_state:'realized'},
    ],error:null}],
    economic_allocations:[{data:[
      {transaction_id:'mixed',responsible_member_id:'member-1',responsible_party_id:null,amount:'60.00'},
      {transaction_id:'third-party',responsible_member_id:null,responsible_party_id:'party-1',amount:'40.00'},
    ],error:null}],
  });

  const rows=await listEconomicMonthExpenses(fake.client as never,'household-1','2026-09');
  assert.deepEqual(rows.map(row=>[row.id,row.amount]),[
    ['mixed','60.00'],
    ['legacy','75.00'],
    ['third-party','0.00'],
  ]);

  assert.ok(fake.calls.some(call=>call.table==='transactions'&&call.method==='eq'&&call.column==='economic_state'&&call.value==='realized'));
  assert.ok(fake.calls.some(call=>call.table==='financial_transaction_positions'&&call.method==='eq'&&call.column==='economic_state'&&call.value==='realized'));
  assert.ok(fake.calls.some(call=>call.table==='financial_transaction_positions'&&call.method==='in'&&call.column==='transaction_id'));
  assert.ok(fake.calls.some(call=>call.table==='economic_allocations'&&call.method==='in'&&call.column==='transaction_id'));
});

test('canonical read-model failure is surfaced instead of silently displaying gross amounts',async()=>{
  const canonicalError={message:'read model unavailable'};
  const fake=fakeClient({
    transactions:[{data:[{id:'mixed',description:'Jantar',amount:'100.00',transaction_date:'2026-09-10',economic_state:'realized',category_id:null,category:null}],error:null}],
    financial_transaction_positions:[{data:null,error:canonicalError}],
    economic_allocations:[{data:[],error:null}],
  });

  await assert.rejects(
    ()=>listEconomicMonthExpenses(fake.client as never,'household-1','2026-09'),
    error=>error===canonicalError,
  );
});
