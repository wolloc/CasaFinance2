import React, { useState } from 'react';
import { Building2, Edit2, Plus, Power, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { ApiService } from '../../services/api.js';
import type { Account, AccountType, User } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface Props {
  accounts: Account[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
  accountType: AccountType;
  title: string;
  description: string;
}

const needsInstitution = (type: AccountType) => ['checking', 'savings', 'investment', 'meal_benefit'].includes(type);
const needsIdentification = (type: AccountType) => ['checking', 'savings', 'meal_benefit'].includes(type);

export const AccountsManager: React.FC<Props> = ({ accounts, householdId, currentUser, onRefresh, accountType, title, description }) => {
  const { householdMembers } = useAuth();
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [identification, setIdentification] = useState('');
  const [ownerId, setOwnerId] = useState(currentUser.id);

  const items = accounts.filter((account) => account.account_type === accountType);
  const showForm = (account?: Account) => {
    setEditing(account ?? null);
    setName(account?.name ?? '');
    setInstitution(account?.institution ?? '');
    setIdentification(account?.identification ?? '');
    setOwnerId(account?.owner_user_id ?? currentUser.id);
    setOpen(true);
    triggerHaptic(account ? 'selection' : 'impact-light');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload: Partial<Account> = { name: name.trim(), institution: institution.trim(), identification: identification.trim(), owner_user_id: ownerId, account_type: accountType };
    try {
      if (editing) await ApiService.updateAccount(householdId, currentUser.id, editing.id, payload);
      else await ApiService.createAccount(householdId, currentUser.id, { ...payload, initial_balance: 0, current_balance: 0 });
      triggerHaptic('success');
      setOpen(false);
      onRefresh();
    } finally { setSaving(false); }
  };

  const deactivate = async (id: string) => {
    if (!confirm('Desativar este cadastro? O histórico financeiro será preservado.')) return;
    await ApiService.deleteAccount(householdId, currentUser.id, id);
    triggerHaptic('success');
    setOpen(false);
    onRefresh();
  };

  return <div className="space-y-4">
    <header className="flex items-start justify-between gap-3">
      <div><h2 className="text-base font-bold text-white">{title}</h2><p className="text-xs text-slate-400">{description}</p></div>
      <button type="button" onClick={() => showForm()} className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white flex items-center gap-1.5"><Plus className="w-4 h-4"/>Cadastrar</button>
    </header>
    <div className="space-y-2">
      {items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-700 p-5 text-center text-xs text-slate-500">Nenhum cadastro ativo.</p>}
      {items.map((item) => {
        const owner = householdMembers.find((member) => member.user_id === item.owner_user_id)?.user?.name ?? 'Casa';
        return <article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">{needsInstitution(accountType) ? <Building2 className="w-5 h-5"/> : <WalletCards className="w-5 h-5"/>}</div>
          <div className="min-w-0 flex-1"><h3 className="font-bold text-sm text-white truncate">{item.name}</h3><p className="text-xs text-slate-400 truncate">{owner}{item.institution ? ` · ${item.institution}` : ''}{item.identification ? ` · ${item.identification}` : ''}</p></div>
          <button type="button" aria-label={`Editar ${item.name}`} onClick={() => showForm(item)} className="min-w-11 min-h-11 rounded-xl border border-slate-700 text-slate-300 flex items-center justify-center"><Edit2 className="w-4 h-4"/></button>
        </article>;
      })}
    </div>
    {open && <div className="fixed inset-0 z-50 bg-black/70 p-4 flex items-end sm:items-center justify-center"><form onSubmit={save} className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-5 space-y-4">
      <div className="flex justify-between"><div><h3 className="font-bold text-white">{editing ? 'Editar cadastro' : `Cadastrar ${title.toLowerCase()}`}</h3><p className="text-xs text-slate-400">Somente dados cadastrais; nenhum saldo é alterado.</p></div><button type="button" onClick={() => setOpen(false)} className="min-w-11 min-h-11 flex justify-center items-center"><X/></button></div>
      <label className="block text-xs text-slate-300">Titular<select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-800 p-3">{householdMembers.filter(m => m.is_active).map(m => <option key={m.user_id} value={m.user_id}>{m.user?.name}</option>)}</select></label>
      <label className="block text-xs text-slate-300">Nome<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-800 p-3" placeholder="Nome para identificação"/></label>
      {needsInstitution(accountType) && <label className="block text-xs text-slate-300">Instituição<input required value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-800 p-3"/></label>}
      {needsIdentification(accountType) && <label className="block text-xs text-slate-300">Identificação<input required value={identification} onChange={(e) => setIdentification(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-800 p-3" placeholder="Agência/conta, apelido ou final"/></label>}
      {accountType === 'investment' && <label className="block text-xs text-slate-300">Tipo (opcional)<input value={identification} onChange={(e) => setIdentification(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-800 p-3" placeholder="CDB, fundo, ações…"/></label>}
      <div className="flex gap-2">{editing && <button type="button" onClick={() => deactivate(editing.id)} className="min-h-11 px-3 rounded-xl bg-rose-950 text-rose-300"><Power className="w-4 h-4"/></button>}<button disabled={saving} className="flex-1 min-h-11 rounded-xl bg-blue-600 font-bold text-sm">{saving ? 'Salvando…' : 'Salvar cadastro'}</button></div>
    </form></div>}
  </div>;
};
