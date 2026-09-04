import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Edit3, Folder, LoaderCircle, Plus, Power } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { CATEGORY_TYPES, createHouseholdCategory, deactivateHouseholdCategory, listHouseholdCategories, updateHouseholdCategory, type HouseholdCategory, type HouseholdCategoryType } from '../../finance/householdCategories.js';

const labels: Record<HouseholdCategoryType, string> = { income: 'Receita', expense: 'Despesa' };

export function HouseholdCategoriesSetup({ onBack }: { onBack: () => void }) {
  const { household } = useSupabaseAuth();
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<HouseholdCategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<HouseholdCategoryType>('expense');

  const refresh = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    try { setCategories(await listHouseholdCategories(supabase, household.id)); } catch { setError('Não foi possível carregar as categorias.'); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [household?.id]);

  const openForm = (category?: HouseholdCategory) => { setEditing(category ?? null); setName(category?.name ?? ''); setType(category?.type ?? 'expense'); setFormOpen(true); setError(null); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (editing) await updateHouseholdCategory(supabase, household.id, editing.id, { name, type });
      else await createHouseholdCategory(supabase, household.id, { name, type });
      setFormOpen(false); setSuccess(editing ? 'Categoria atualizada.' : 'Categoria criada.'); await refresh();
    } catch { setError('Não foi possível salvar a categoria. Verifique o nome e o tipo.'); } finally { setSaving(false); }
  };
  const deactivate = async (category: HouseholdCategory) => {
    if (!supabase || !household || !confirm(`Desativar a categoria “${category.name}”?`)) return;
    setError(null); setSuccess(null);
    try { await deactivateHouseholdCategory(supabase, household.id, category.id); setSuccess('Categoria desativada. O registro foi preservado.'); await refresh(); } catch { setError('Não foi possível desativar a categoria.'); }
  };

  return <main className="min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:flex sm:justify-center"><div className="w-full max-w-2xl space-y-5"><button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4" />Casa e membros</button><header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{household?.name}</p><h1 className="mt-1 text-2xl font-black">Categorias</h1><p className="mt-1 text-sm text-slate-400">Classificação de receitas e despesas da Casa.</p></div><button type="button" onClick={() => openForm()} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Adicionar categoria</button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}{success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-400" /> : categories.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">Nenhuma categoria ativa cadastrada.</p> : <div className="grid gap-3 sm:grid-cols-2">{categories.map((category) => <article key={category.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><Folder className="mt-0.5 h-5 w-5 text-blue-400" /><div className="min-w-0 flex-1"><h2 className="font-bold">{category.name}</h2><p className="text-sm text-slate-400">{labels[category.type]} · Ativa</p></div><button type="button" aria-label={`Editar ${category.name}`} onClick={() => openForm(category)} className="min-h-10 min-w-10 rounded-xl border border-slate-700"><Edit3 className="mx-auto h-4 w-4" /></button><button type="button" aria-label={`Desativar ${category.name}`} onClick={() => deactivate(category)} className="min-h-10 min-w-10 rounded-xl border border-rose-900 text-rose-300"><Power className="mx-auto h-4 w-4" /></button></div></article>)}</div>}
    {formOpen && <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 sm:items-center"><form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-lg font-bold">{editing ? 'Editar categoria' : 'Adicionar categoria'}</h2><label className="block text-sm text-slate-300">Nome<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label><label className="block text-sm text-slate-300">Tipo<select value={type} onChange={(event) => setType(event.target.value as HouseholdCategoryType)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{CATEGORY_TYPES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label><div className="flex gap-3"><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">Cancelar</button><button type="submit" disabled={saving} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Salvar</button></div></form></div>}
  </div></main>;
}