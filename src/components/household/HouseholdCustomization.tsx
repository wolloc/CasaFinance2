import { useEffect, useState } from 'react';
import { Check, Home, Pencil, UserCheck, UserPlus, UserX, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../context/AuthContext.js';
import { ApiService } from '../../services/api.js';
import type { HouseholdMember, User } from '../../types/index.js';

interface Props { householdId: string; currentUser: User; onRefresh: () => void }

export function HouseholdCustomization({ householdId, currentUser, onRefresh }: Props) {
  const { activeHousehold, householdMembers, refreshHousehold } = useAuth();
  const [name, setName] = useState(activeHousehold?.name || '');
  const [editing, setEditing] = useState<HouseholdMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', color: '#0f766e', avatar: '' });
  const [message, setMessage] = useState('');
  const activeCount = householdMembers.filter((member) => member.is_active).length;

  useEffect(() => setName(activeHousehold?.name || ''), [activeHousehold?.name]);

  const reload = async (text: string) => { await refreshHousehold(); onRefresh(); setMessage(text); };
  const saveHousehold = async () => { await ApiService.updateHousehold(householdId, currentUser.id, name); await reload('Nome da casa atualizado.'); };
  const submitProfile = async () => {
    if (editing) await ApiService.updateHouseholdMember(householdId, currentUser.id, editing.id, form);
    else await ApiService.inviteHouseholdMember(householdId, currentUser.id, form);
    setEditing(null); setInviteOpen(false); setForm({ name: '', email: '', color: '#0f766e', avatar: '' });
    await reload(editing ? 'Perfil atualizado em filtros e badges.' : 'Membro convidado.');
  };
  const toggle = async (member: HouseholdMember) => {
    await ApiService.updateHouseholdMember(householdId, currentUser.id, member.id, { is_active: !member.is_active });
    await reload(member.is_active ? 'Membro desativado sem apagar seu histórico.' : 'Membro reativado.');
  };
  const openEdit = (member: HouseholdMember) => { setEditing(member); setForm({ name: member.user?.name || '', email: member.user?.email || '', color: member.color, avatar: member.avatar || member.user?.avatar_url || '' }); };

  return <section className="space-y-3" aria-labelledby="household-heading">
    <div className="flex items-center justify-between px-1"><h2 id="household-heading" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Users className="h-4 w-4 text-blue-400" />Casa e membros</h2><span className="text-xs text-slate-400">{activeCount}/2 ativos</span></div>
    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center gap-2"><Home className="h-5 w-5 text-blue-400" /><label htmlFor="house-name" className="sr-only">Nome da casa</label><input id="house-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-bold text-white"/><button type="button" onClick={saveHousehold} className="min-h-11 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white"><Check className="h-4 w-4" /></button></div>
      <div className="grid gap-2 sm:grid-cols-2">{householdMembers.map((member) => <article key={member.id} className={`rounded-2xl border p-3 ${member.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white" style={{ backgroundColor: member.color }}>{member.avatar || member.user?.avatar_url ? <img src={member.avatar || member.user?.avatar_url} alt="" className="h-full w-full object-cover"/> : member.user?.name?.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{member.user?.name}</strong><span className="text-[11px] text-slate-400">{member.is_active ? 'Ativo' : 'Inativo · histórico mantido'}</span></div><button type="button" aria-label="Editar membro" onClick={() => openEdit(member)} className="min-h-11 min-w-11 rounded-xl p-3 text-slate-300"><Pencil className="h-4 w-4" /></button></div>
        <button type="button" disabled={member.user_id === currentUser.id} onClick={() => toggle(member)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 disabled:opacity-30">{member.is_active ? <UserX className="h-4 w-4"/> : <UserCheck className="h-4 w-4"/>}{member.is_active ? 'Desativar' : 'Reativar'}</button>
      </article>)}</div>
      <button type="button" disabled={activeCount >= 2} onClick={() => setInviteOpen(true)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-xs font-bold text-white disabled:bg-slate-700"><UserPlus className="h-4 w-4"/>{activeCount >= 2 ? 'Limite de 2 membros ativos' : 'Convidar membro'}</button>
      {message && <p role="status" className="text-xs font-semibold text-emerald-400">{message}</p>}
    </div>
    <AnimatePresence>{(editing || inviteOpen) && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center"><div className="w-full max-w-md space-y-3 rounded-3xl bg-slate-900 p-5"><div className="flex justify-between"><h3 className="font-bold text-white">{editing ? 'Editar membro' : 'Convidar membro'}</h3><button type="button" onClick={() => {setEditing(null);setInviteOpen(false)}}><X className="text-slate-400"/></button></div><input aria-label="Nome do membro" placeholder="Nome" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="min-h-11 w-full rounded-xl bg-slate-950 px-3 text-white"/>{!editing && <input aria-label="E-mail do membro" type="email" placeholder="E-mail" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="min-h-11 w-full rounded-xl bg-slate-950 px-3 text-white"/>}<input aria-label="URL do avatar" placeholder="URL do avatar (opcional)" value={form.avatar} onChange={(e)=>setForm({...form,avatar:e.target.value})} className="min-h-11 w-full rounded-xl bg-slate-950 px-3 text-white"/><label className="flex items-center gap-3 text-xs text-slate-300">Cor acessível <input type="color" value={form.color} onChange={(e)=>setForm({...form,color:e.target.value})} className="h-11 w-16 rounded-lg"/></label><button type="button" disabled={!form.name.trim() || (!editing && !form.email.trim())} onClick={submitProfile} className="min-h-11 w-full rounded-xl bg-blue-600 font-bold text-white disabled:opacity-40">Salvar</button></div></motion.div>}</AnimatePresence>
  </section>;
}
