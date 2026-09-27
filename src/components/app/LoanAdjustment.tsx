import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Banknote, Landmark, LoaderCircle, UserPlus } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { createFinancialParty, createLoanPrincipalWithSchedule, listFinancialParties, type FinancialParty } from '../../finance/loanPrincipals.js';

const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => { const now = new Date(); const offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10); };

export function LoanAdjustment({ onBack, backLabel = 'Voltar', initialDirection, initialAccountId, showBack = true }: { onBack: () => void; backLabel?: string; initialDirection?: 'granted' | 'taken'; initialAccountId?: string; showBack?: boolean }) {
  const { household, householdMembers, user } = useSupabaseAuth();
  const [direction, setDirection] = useState<'granted' | 'taken'>(initialDirection ?? 'granted');
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(localDate());
  const [repaymentMode,setRepaymentMode]=useState<'single'|'installments'>('single');
  const [installmentCount,setInstallmentCount]=useState(1);
  const [firstDueDate,setFirstDueDate]=useState('');
  const [totalInterest,setTotalInterest]=useState('');
  const [totalFee,setTotalFee]=useState('');
  const [costResponsibleMemberId,setCostResponsibleMemberId]=useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const currentMember=useMemo(()=>householdMembers.find(member=>member.profile_id===user?.id)??null,[householdMembers,user?.id]);

  const clearLoadedContext = () => { setParties([]); setAccounts([]); setCounterpartyId(''); setAccountId(''); };
  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setLoadError(null); setError(null);
    try { const [people, financial] = await Promise.all([listFinancialParties(supabase, household.id), listHouseholdFinancialAccounts(supabase, household.id)]); const transactional=financial.accounts.filter(account=>!account.resource_restriction&&['cash','checking','savings','digital_wallet'].includes(account.type)); setParties(people); setAccounts(transactional); setAccountId(current=>current&&transactional.some(account=>account.id===current)?current:initialAccountId&&transactional.some(account=>account.id===initialAccountId)?initialAccountId:''); }
    catch { clearLoadedContext(); setLoadError('Não foi possível conferir pessoas e contas da Casa. O empréstimo não pode ser registrado até uma nova leitura válida.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [household?.id]);
  useEffect(() => { if (initialDirection) setDirection(initialDirection); }, [initialDirection]);
  useEffect(() => { if (initialAccountId) setAccountId(initialAccountId); }, [initialAccountId]);
  const selectedParty = useMemo(() => parties.find((party) => party.id === counterpartyId), [parties, counterpartyId]);
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accounts, accountId]);
  const contextualBank = direction === 'taken' && initialAccountId && selectedAccount?.institution?.trim() ? selectedAccount.institution.trim() : null;
  const lockedDirection = Boolean(initialDirection);
  const lockedAccount = Boolean(initialAccountId && selectedAccount);
  const normalizedInterest=Number(normalizeAmount(totalInterest||'0'))||0;
  const normalizedFee=Number(normalizeAmount(totalFee||'0'))||0;
  const totalToRepay=(Number(normalizeAmount(amount||'0'))||0)+normalizedInterest+normalizedFee;
  useEffect(()=>{if(direction==='taken'&&!costResponsibleMemberId&&currentMember?.id)setCostResponsibleMemberId(currentMember.id);},[direction,currentMember?.id,costResponsibleMemberId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !household) return;
    if (loadError || loading) { setError('Confira novamente as pessoas e contas antes de registrar o empréstimo.'); return; }
    const normalizedAmount = normalizeAmount(amount); const numericAmount = Number(normalizedAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!accountId) { setError(direction === 'granted' ? 'Informe de qual recurso o dinheiro saiu.' : 'Informe em qual recurso o dinheiro entrou.'); return; }
    const partyName = contextualBank ?? selectedParty?.name ?? newPartyName.trim();
    if (!counterpartyId && !partyName) { setError('Escolha com quem foi o empréstimo.'); return; }
    const count=repaymentMode==='single'?1:installmentCount;
    if (!firstDueDate || firstDueDate < occurredAt) { setError('Informe o primeiro vencimento em uma data igual ou posterior ao empréstimo.'); return; }
    if (!Number.isInteger(count)||count<1||count>120){setError('Informe uma quantidade de parcelas entre 1 e 120.');return;}
    if(direction==='taken'&&(normalizedInterest>0||normalizedFee>0)&&!costResponsibleMemberId){setError('Informe quem assume os juros e tarifas deste empréstimo.');return;}
    setSaving(true); setError(null); setSuccess(null);
    try {
      let partyId = counterpartyId; if (!partyId) { const existing = parties.find((party) => party.name.trim().toLocaleLowerCase('pt-BR') === partyName.toLocaleLowerCase('pt-BR')); partyId = existing?.id ?? await createFinancialParty(supabase, household.id, partyName); }
      const description = direction === 'taken' ? `Empréstimo de ${partyName}` : `Empréstimo para ${partyName}`;
      await createLoanPrincipalWithSchedule(supabase,{householdId:household.id,direction,counterpartyId:partyId,accountId,amount:normalizedAmount,occurredAt,firstDueDate,installmentCount:count,totalInterest:direction==='taken'?normalizeAmount(totalInterest||'0'):'0',totalFee:direction==='taken'?normalizeAmount(totalFee||'0'):'0',costResponsibleMemberId:direction==='taken'&&(normalizedInterest>0||normalizedFee>0)?costResponsibleMemberId:null,description});
      setSuccess(direction === 'granted' ? 'Pronto. O dinheiro saiu da conta escolhida e o Casa guardou que essa pessoa precisa devolver esse valor. Isso não virou uma despesa.' : 'Pronto. O dinheiro entrou na conta escolhida e o Casa guardou que esse valor precisa ser devolvido. Isso não virou uma renda.');
      setAmount('');setRepaymentMode('single');setInstallmentCount(1);setFirstDueDate('');setTotalInterest('');setTotalFee('');setNewPartyName('');await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o empréstimo.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    {showBack&&<button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← {backLabel}</button>}
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : loadError ? <div className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">{direction === 'taken' ? 'Peguei dinheiro emprestado' : 'Emprestei dinheiro'}</h2><p className="mt-1 text-sm text-slate-400">{direction === 'taken' ? 'O dinheiro entra em um recurso da Casa e nasce uma dívida. Isso não é renda.' : 'O dinheiro sai de um recurso da Casa e nasce um valor a receber. Isso não é despesa.'}</p></div>
      {!lockedDirection&&<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setDirection('granted')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'granted' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Emprestei</button><button type="button" onClick={() => setDirection('taken')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'taken' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Peguei emprestado</button></div>}
      {contextualBank?<div className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-3"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-blue-300"/><strong className="text-sm text-blue-100">{contextualBank}</strong></div><p className="mt-1 text-xs text-slate-400">Iniciado a partir de {selectedAccount?.name}. O Casa usa {contextualBank} como credor e esta conta como destino do dinheiro.</p></div>:<>
        <label className="block text-sm">Com quem foi o empréstimo?<select value={counterpartyId} onChange={(event) => { setCounterpartyId(event.target.value); if (event.target.value) setNewPartyName(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Adicionar outra pessoa</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        {!counterpartyId && <label className="block text-sm">Nome da pessoa<input value={newPartyName} onChange={(event) => setNewPartyName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: Robson" /></label>}
      </>}
      {lockedAccount&&selectedAccount?<div className="rounded-xl bg-slate-950/70 p-3"><p className="text-xs text-slate-500">{direction === 'granted' ? 'Saiu de' : 'Entrou em'}</p><strong className="mt-1 block text-sm">{selectedAccount.name}</strong>{selectedAccount.institution&&<span className="mt-1 block text-xs text-slate-500">{selectedAccount.institution}</span>}</div>:<label className="block text-sm">{direction === 'granted' ? 'De qual conta saiu o dinheiro?' : 'Em qual conta entrou o dinheiro?'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.institution?`${account.name} · ${account.institution}`:account.name}</option>)}</select></label>}
      <label className="block text-sm">Quanto foi emprestado?<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Quando aconteceu?<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <fieldset><legend className="text-sm font-semibold">{direction==='taken'?'Como pretende pagar este valor?':'Como pretende receber este valor?'}</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>{setRepaymentMode('single');setInstallmentCount(1);}} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${repaymentMode==='single'?'border-blue-500 bg-blue-950/40 text-blue-200':'border-slate-700 text-slate-400'}`}>Uma vez</button><button type="button" onClick={()=>{setRepaymentMode('installments');if(installmentCount<2)setInstallmentCount(3);}} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${repaymentMode==='installments'?'border-blue-500 bg-blue-950/40 text-blue-200':'border-slate-700 text-slate-400'}`}>Parcelado</button></div></fieldset>
      {repaymentMode==='installments'&&<fieldset><legend className="text-sm font-semibold">Em quantas vezes?</legend><div className="mt-2 grid grid-cols-4 gap-2">{[3,6,12].map(value=><button type="button" key={value} onClick={()=>setInstallmentCount(value)} className={`min-h-10 rounded-xl border text-sm font-semibold ${installmentCount===value?'border-blue-500 bg-blue-950/40 text-blue-200':'border-slate-700 text-slate-400'}`}>{value}x</button>)}<input aria-label="Quantidade de parcelas" type="number" min="2" max="120" value={installmentCount} onChange={event=>setInstallmentCount(Math.max(2,Math.min(120,Number(event.target.value)||2)))} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-2 text-center text-sm"/></div></fieldset>}
      <label className="block text-sm">{repaymentMode==='single'?'Quando vence?':'Quando vence a primeira parcela?'}<input type="date" value={firstDueDate} onChange={event=>setFirstDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
      {direction==='taken'&&<section className="space-y-3 rounded-2xl border border-amber-900/40 bg-amber-950/10 p-3"><div><p className="text-sm font-semibold text-amber-100">Custos do contrato</p><p className="mt-1 text-xs text-slate-500">Informe o total contratado. O Casa distribui no cronograma; isso não vira despesa realizada hoje.</p></div><div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Juros totais<input inputMode="decimal" value={totalInterest} onChange={event=>setTotalInterest(event.target.value)} placeholder="0,00" className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm"/></label><label className="text-xs text-slate-300">Tarifas totais<input inputMode="decimal" value={totalFee} onChange={event=>setTotalFee(event.target.value)} placeholder="0,00" className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm"/></label></div>{(normalizedInterest>0||normalizedFee>0)&&<label className="block text-xs text-slate-300">Quem assume esses custos?<select value={costResponsibleMemberId} onChange={event=>setCostResponsibleMemberId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm"><option value="">Selecione</option>{householdMembers.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}<div className="rounded-xl bg-slate-950/65 p-3 text-xs text-slate-400"><div className="flex justify-between"><span>Principal</span><strong>{Number(normalizeAmount(amount||'0')||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div><div className="mt-1 flex justify-between"><span>Juros + tarifas</span><strong>{(normalizedInterest+normalizedFee).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div><div className="mt-2 flex justify-between border-t border-slate-800 pt-2 text-slate-200"><span>Total previsto</span><strong>{totalToRepay.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div></div></section>}
      <p className="rounded-xl bg-slate-950/70 p-3 text-xs text-slate-500">Cada parcela é uma agenda de pagamento ligada ao mesmo principal. Juros e tarifas futuros ficam projetados até virarem fatos econômicos. Multa só nasce se houver atraso real.</p>
      {selectedParty && <p className="text-xs text-slate-500">Pessoa escolhida: {selectedParty.name}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      <button type="submit" disabled={saving || accounts.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><Banknote className="h-4 w-4"/>{saving ? 'Registrando…' : direction === 'taken' ? 'Registrar empréstimo recebido' : 'Registrar dinheiro emprestado'}</button>
      {accounts.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400"><UserPlus className="mr-1 inline h-4 w-4"/>Cadastre uma conta que movimenta dinheiro antes de registrar um empréstimo.</p>}
    </form>}
  </div>;
}
