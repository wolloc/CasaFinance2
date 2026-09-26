import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Edit3, LoaderCircle, MoreHorizontal, Plus, Power } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { CATEGORY_TYPES, createHouseholdCategory, deactivateHouseholdCategory, listHouseholdCategories, updateHouseholdCategory, type HouseholdCategory, type HouseholdCategoryType } from '../../finance/householdCategories.js';
import { CATEGORY_COLOR_OPTIONS, CATEGORY_ICON_OPTIONS, getCategoryVisual } from '../categoryVisuals.js';

const labels:Record<HouseholdCategoryType,string>={income:'Entradas',expense:'Gastos'};

export function HouseholdCategoriesSetup({onBack}:{onBack:()=>void}){
 const{household}=useSupabaseAuth();
 const[categories,setCategories]=useState<HouseholdCategory[]>([]);
 const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
 const[loadError,setLoadError]=useState<string|null>(null);const[error,setError]=useState<string|null>(null);const[success,setSuccess]=useState<string|null>(null);
 const[editing,setEditing]=useState<HouseholdCategory|null>(null);const[formOpen,setFormOpen]=useState(false);
 const[name,setName]=useState('');const[type,setType]=useState<HouseholdCategoryType>('expense');
 const[icon,setIcon]=useState('');const[color,setColor]=useState('');

 const clearLoadedContext=()=>{setCategories([]);setEditing(null);setFormOpen(false);};
 const refresh=async()=>{if(!supabase||!household)return;setLoading(true);setLoadError(null);setError(null);try{setCategories(await listHouseholdCategories(supabase,household.id));}catch{clearLoadedContext();setLoadError('Não foi possível conferir as categorias agora.');}finally{setLoading(false);}};
 useEffect(()=>{void refresh();},[household?.id]);

 const openForm=(category?:HouseholdCategory)=>{
   if(loadError||loading)return;
   setEditing(category??null);
   setName(category?.name??'');
   setType(category?.type??'expense');
   const storedIcon=category?.icon?.trim()||'';
   const storedColor=category?.color?.trim().toLocaleLowerCase('en-US')||'';
   setIcon(storedIcon&&storedIcon!=='tag'?storedIcon:'');
   setColor(storedColor&&storedColor!=='#64748b'?storedColor:'');
   setFormOpen(true);setError(null);
 };
 const save=async(event:FormEvent)=>{
   event.preventDefault();
   if(loadError||loading){setError('Confira novamente as categorias antes de salvar.');return;}
   if(!supabase||!household)return;
   setSaving(true);setError(null);setSuccess(null);
   try{
     const input={name,type,icon,color:color||null};
     if(editing)await updateHouseholdCategory(supabase,household.id,editing.id,input);
     else await createHouseholdCategory(supabase,household.id,input);
     setFormOpen(false);setSuccess(editing?'Categoria atualizada.':'Categoria criada.');await refresh();
   }catch{setError('Não foi possível salvar a categoria.');}
   finally{setSaving(false);}
 };
 const deactivate=async(category:HouseholdCategory)=>{if(loadError||loading)return;if(!supabase||!household||!confirm(`Parar de usar “${category.name}”? Os lançamentos antigos continuam preservados.`))return;setError(null);setSuccess(null);try{await deactivateHouseholdCategory(supabase,household.id,category.id);setSuccess('Categoria retirada de uso.');await refresh();}catch{setError('Não foi possível retirar esta categoria de uso.');}};
 const expenseCategories=categories.filter(category=>category.type==='expense');
 const incomeCategories=categories.filter(category=>category.type==='income');
 const preview=useMemo(()=>getCategoryVisual({name,type,icon,color}),[name,type,icon,color]);
 const PreviewIcon=preview.Icon;

 return <main className="min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:flex sm:justify-center"><div className="w-full max-w-2xl space-y-5">
  <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-blue-300 hover:bg-slate-900"><ArrowLeft className="h-4 w-4"/>Voltar aos ajustes</button>
  <header className="flex items-center justify-between gap-3"><h1 className="text-3xl font-black">Categorias</h1><button type="button" disabled={loading||!!loadError} onClick={()=>openForm()} className="flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-bold disabled:opacity-50"><Plus className="h-4 w-4"/>Nova</button></header>

  {loadError&&<div className="rounded-2xl bg-rose-950/30 p-4"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void refresh()} className="mt-3 min-h-11 rounded-xl px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div>}
  {!loadError&&error&&<p role="alert" className="rounded-xl bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
  {success&&<p role="status" className="rounded-xl bg-emerald-950/30 p-3 text-sm text-emerald-200">{success}</p>}

  {loading?<LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-400"/>:!loadError&&categories.length===0?<p className="rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">Crie a primeira categoria quando quiser organizar seus lançamentos.</p>:!loadError&&<div className="space-y-6">
   <CategoryGroup title="Categorias de gastos" categories={expenseCategories} onEdit={openForm} onDeactivate={deactivate}/>
   <CategoryGroup title="Categorias de entradas" categories={incomeCategories} onEdit={openForm} onDeactivate={deactivate}/>
  </div>}

  {!loadError&&formOpen&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><form onSubmit={save} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
    <div className="flex items-center gap-3"><span style={preview.color?{color:preview.color}:undefined} className={`flex h-12 w-12 items-center justify-center rounded-2xl ${type==='income'?'bg-emerald-500/10 text-emerald-300':'bg-rose-500/10 text-rose-300'}`}><PreviewIcon className="h-6 w-6"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-blue-300">{editing?'Editar':'Nova'}</p><h2 className="text-xl font-black">{name.trim()||'Categoria'}</h2></div></div>
    <label className="block text-sm font-semibold">Nome<input autoFocus required maxLength={80} value={name} onChange={event=>setName(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-950 p-3 text-base" placeholder="Ex.: Mercado"/></label>
    <label className="block text-sm font-semibold">Usada em<select value={type} onChange={event=>setType(event.target.value as HouseholdCategoryType)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-950 p-3">{CATEGORY_TYPES.map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>

    <fieldset><legend className="mb-2 text-sm font-semibold">Ícone</legend><div className="grid grid-cols-6 gap-2 sm:grid-cols-9"><button type="button" title="Automático" aria-label="Ícone automático" aria-pressed={!icon} onClick={()=>setIcon('')} className={`flex aspect-square items-center justify-center rounded-xl border text-[10px] font-bold transition ${!icon?'border-blue-400 bg-blue-500/15 text-blue-200':'border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>Auto</button>{CATEGORY_ICON_OPTIONS.map(option=>{const SelectedIcon=option.Icon;const selected=icon===option.name;return <button key={option.name} type="button" title={option.label} aria-label={`Ícone ${option.label}`} aria-pressed={selected} onClick={()=>setIcon(option.name)} className={`flex aspect-square items-center justify-center rounded-xl border transition ${selected?'border-blue-400 bg-blue-500/15 text-blue-200':'border-slate-800 bg-slate-950 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}><SelectedIcon className="h-5 w-5"/></button>})}</div></fieldset>

    <fieldset><legend className="mb-2 text-sm font-semibold">Cor</legend><div className="flex flex-wrap gap-2"><button type="button" aria-label="Cor automática" aria-pressed={!color} onClick={()=>setColor('')} className={`min-h-10 rounded-xl border px-3 text-xs font-bold ${!color?'border-blue-400 bg-blue-500/15 text-blue-200':'border-slate-800 text-slate-400'}`}>Automática</button>{CATEGORY_COLOR_OPTIONS.map(option=><button key={option} type="button" aria-label={`Cor ${option}`} aria-pressed={color===option} onClick={()=>setColor(option)} style={{backgroundColor:option}} className={`h-10 w-10 rounded-xl border-2 ${color===option?'border-white':'border-transparent'}`}/>)}</div></fieldset>

    <div className="flex gap-3"><button type="button" onClick={()=>setFormOpen(false)} className="min-h-11 flex-1 rounded-xl text-slate-300">Cancelar</button><button type="submit" disabled={saving||!name.trim()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50">{saving&&<LoaderCircle className="h-4 w-4 animate-spin"/>}Salvar</button></div>
  </form></div>}
 </div></main>;
}

function CategoryGroup({title,categories,onEdit,onDeactivate}:{title:string;categories:HouseholdCategory[];onEdit:(category:HouseholdCategory)=>void;onDeactivate:(category:HouseholdCategory)=>void}){
 const income=categories[0]?.type==='income';
 return <section><div className="mb-3 flex items-end justify-between"><h2 className="text-lg font-black">{title}</h2><span className="text-xs text-slate-600">{categories.length}</span></div>{categories.length===0?<p className="rounded-2xl bg-slate-900/35 p-4 text-sm text-slate-500">Nenhuma categoria aqui.</p>:<div className="grid gap-2 sm:grid-cols-2">{categories.map(category=>{const {Icon,color}=getCategoryVisual(category);const tone=income?'text-emerald-300':'text-rose-300';const bg=income?'bg-emerald-500/10':'bg-rose-500/10';return <article key={category.id} className="flex min-h-16 items-center gap-3 rounded-[1.35rem] bg-slate-900/55 px-3 py-2"><span style={color?{color}:undefined} className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl '+bg+' '+tone}><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><strong className="block truncate">{category.name}</strong><span className="text-xs text-slate-500">{income?'Entrada':'Gasto'}</span></div><details className="relative"><summary aria-label={'Opções de '+category.name} className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-800"><MoreHorizontal className="h-5 w-5"/></summary><div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl"><button type="button" onClick={()=>onEdit(category)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-800"><Edit3 className="h-4 w-4"/>Editar visual</button><button type="button" onClick={()=>void onDeactivate(category)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-rose-300 hover:bg-rose-950/30"><Power className="h-4 w-4"/>Parar de usar</button></div></details></article>})}</div>}</section>;
}
