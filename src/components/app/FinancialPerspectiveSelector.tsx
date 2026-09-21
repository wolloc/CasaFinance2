import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

export type FinancialPerspective = 'household' | string;

export function FinancialPerspectiveSelector({value,onChange}:{value:FinancialPerspective;onChange:(value:FinancialPerspective)=>void}){
  const{householdMembers}=useSupabaseAuth();
  return <div aria-label="Perspectiva financeira" className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
    <button type="button" onClick={()=>onChange('household')} aria-pressed={value==='household'} className={'min-h-10 rounded-xl px-2 text-xs font-bold '+(value==='household'?'bg-blue-600 text-white':'text-slate-400')}>Nossa Casa</button>
    {householdMembers.slice(0,2).map(member=><button type="button" key={member.id} onClick={()=>onChange(member.id)} aria-pressed={value===member.id} className={'min-h-10 truncate rounded-xl px-2 text-xs font-bold '+(value===member.id?'bg-blue-600 text-white':'text-slate-400')}>{member.display_name}</button>)}
  </div>;
}
